import { pdfRows, num, idDate, type PdfRow } from './pdf-rows.ts';

export type IpotTxType =
  | 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAWAL' | 'DIVIDEND' | 'INTEREST' | 'FEE' | 'TAX' | 'ADJUSTMENT';

export interface IpotTx {
  tradeDate: string;
  settleDate: string | null;
  type: IpotTxType;
  symbol: string | null;
  description: string;
  quantity: number | null;
  price: number | null;
  /** Signed, IDR. Positive is money into the account. */
  amount: number;
  externalRef: string | null;
}

export interface IpotStatement {
  accountCode: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  beginningBalance: number | null;
  endingBalance: number | null;
  transactions: IpotTx[];
}

/** Money-looking cell, so a price (955.00) is not mistaken for an amount. */
const isMoney = (s: string) => /^-?[\d,]+(\.\d{2})?$/.test(s.trim());

/**
 * Classify a ledger line from its description. IPOT writes these in a mix of
 * Indonesian and English, so the vocabulary is listed rather than guessed at.
 */
function classify(desc: string): { type: IpotTxType; symbol: string | null } {
  const d = desc.trim();
  let m: RegExpMatchArray | null;

  if ((m = d.match(/^Buy\s+([A-Z]{2,6})/i))) return { type: 'BUY', symbol: m[1].toUpperCase() };
  if ((m = d.match(/^Sell\s+([A-Z]{2,6})/i))) return { type: 'SELL', symbol: m[1].toUpperCase() };
  if ((m = d.match(/Deviden\s+Tunai\s+([A-Z]{2,6})/i))) return { type: 'DIVIDEND', symbol: m[1].toUpperCase() };
  if (/RDN\s+Interest|Bunga/i.test(d)) return { type: 'INTEREST', symbol: null };
  if (/Receive\s+Payment/i.test(d)) return { type: 'DEPOSIT', symbol: null };
  if (/Withdraw|Payment\s+to|Transfer\s+Out/i.test(d)) return { type: 'WITHDRAWAL', symbol: null };
  // "Biaya Meterai Lunas" — the Rp 10,000 stamp duty on each contract note.
  if (/Biaya|Meterai|Fee|Charge/i.test(d)) return { type: 'FEE', symbol: null };
  if (/Pajak|Tax/i.test(d)) return { type: 'TAX', symbol: null };
  return { type: 'ADJUSTMENT', symbol: null };
}

export async function parseIpotStatement(data: Buffer): Promise<IpotStatement> {
  const rows = await pdfRows(data);
  const flat = rows.map((r) => r.cells.join(' '));

  const accountCode = (flat.join('\n').match(/Client(?: Code)?\s+(R\d{6,})/) || [])[1] ?? null;
  const period = flat.join('\n').match(/Date from\s*:\s*(\d{2}-[A-Za-z]{3}-\d{2})\s*to\s*(\d{2}-[A-Za-z]{3}-\d{2})/);
  const periodFrom = period ? idDate(period[1]) : null;
  const periodTo = period ? idDate(period[2]) : null;

  let beginningBalance: number | null = null;
  let endingBalance: number | null = null;
  const transactions: IpotTx[] = [];

  /**
   * An entry starts on a NUMBERED row and continues on unnumbered ones — a
   * multi-fill buy prints one line per fill and closes with a totals line
   * carrying the running balance. Reading only numbered rows would drop every
   * fill after the first.
   */
  let current: { tradeDate: string; settleDate: string | null; lines: PdfRow[] } | null = null;

  const flush = () => {
    if (!current) return;
    for (const line of current.lines) {
      const cells = line.cells;
      // Strip the leading index and the two dates when present.
      let i = 0;
      if (/^\d+$/.test(cells[0] ?? '')) i = 1;
      if (idDate(cells[i])) i += 1;
      if (idDate(cells[i])) i += 1;

      const desc = cells[i] ?? '';
      if (!desc || /^-?[\d,]/.test(desc)) continue;      // a pure totals line
      if (/^Ref\.:/i.test(desc)) {                        // reference for the entry above
        const ref = desc.replace(/^Ref\.:\s*/i, '').trim();
        const last = transactions[transactions.length - 1];
        if (last && !last.externalRef) last.externalRef = ref;
        continue;
      }

      const rest = cells.slice(i + 1).filter(isMoney).map((c) => num(c)!).filter((n) => n !== null);
      const { type, symbol } = classify(desc);

      // A trade line reads price, volume, amount; everything else reads amount.
      let price: number | null = null;
      let quantity: number | null = null;
      let amount: number | null = null;

      if ((type === 'BUY' || type === 'SELL') && rest.length >= 3) {
        [price, quantity, amount] = [rest[0], rest[1], rest[2]];
      } else if (rest.length) {
        // Prefer the first non-zero figure: the debit/credit pair prints a 0 in
        // whichever column does not apply.
        amount = rest.find((n) => n !== 0) ?? rest[0];
      }
      if (amount === null) continue;

      transactions.push({
        tradeDate: current.tradeDate,
        settleDate: current.settleDate,
        type,
        symbol,
        description: desc,
        quantity,
        price,
        amount,
        externalRef: null,
      });
    }
    current = null;
  };

  for (const row of rows) {
    const cells = row.cells;
    const joined = cells.join(' ');

    if (/BEGINNING BALANCE/i.test(joined)) {
      // FIRST number after the label, not the last: the 2025 layout prints
      // "BEGINNING BALANCE | 339,317,142 | 0" and taking the last read 0.
      const after = cells.slice(cells.findIndex((c) => /BEGINNING BALANCE/i.test(c)) + 1);
      beginningBalance = after.map(num).find((n): n is number => n !== null) ?? null;
      continue;
    }
    /**
     * "End Penalty Calculation" is the closing line, not a movement. Counting it
     * as one added the whole closing balance a second time, which is why every
     * statement computed to roughly twice its printed total.
     *
     * Its FIRST number is the closing balance in all three layouts seen
     * (2021, 2022, 2025). The END BALANCE row is not usable for this: its column
     * count changes by year — 2022 ends with a Penalty 0, and 2025 prints the
     * balance twice with a trailing 0 — so "the last number" is 0 in both.
     */
    if (/End Penalty Calculation/i.test(joined)) {
      // Skip the row index and the two dates first — taking "the first number"
      // outright picked up the index (20) instead of the balance.
      const after = cells.slice(cells.findIndex((c) => /End Penalty Calculation/i.test(c)) + 1);
      const first = after.map(num).find((n): n is number => n !== null);
      if (first !== undefined) endingBalance = first;
      flush();
      current = null;
      continue;
    }
    if (/END BALANCE/i.test(joined)) continue;
    if (/^No\.$/.test(cells[0] ?? '') || /Client Statement|INDO PREMIER|Page \d/i.test(joined)) continue;

    const numbered = /^\d+$/.test(cells[0] ?? '');
    const d1 = idDate(cells[numbered ? 1 : 0]);

    if (numbered && d1) {
      flush();
      current = { tradeDate: d1, settleDate: idDate(cells[2]) ?? null, lines: [row] };
    } else if (current) {
      current.lines.push(row);
    }
  }
  flush();

  return { accountCode, periodFrom, periodTo, beginningBalance, endingBalance, transactions };
}

/** Does the ledger add up to the balance IPOT printed? */
export function reconcileIpot(s: IpotStatement): { ok: boolean; expected: number | null; actual: number | null } {
  if (s.beginningBalance === null || s.endingBalance === null) {
    return { ok: false, expected: s.endingBalance, actual: null };
  }
  const moved = s.transactions.reduce((a, t) => a + t.amount, 0);
  const actual = Math.round((s.beginningBalance + moved) * 100) / 100;
  return { ok: Math.abs(actual - s.endingBalance) <= 1, expected: s.endingBalance, actual };
}
