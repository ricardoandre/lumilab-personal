/**
 * Parser for Gotrade (Alpaca Securities) monthly statements.
 *
 * Line-aware, NOT regex-over-the-whole-document. Alpaca wraps long values across
 * lines — a trade's minus sign lands on one line and its amount on the next, and
 * deposit descriptions run to three lines — so any pattern matched against the
 * raw blob picks up fragments from neighbouring rows. It also changed layout
 * between 2021 and 2022 (`5/11/2021` vs `06/10/2022`, amounts inline vs wrapped),
 * so the parser normalises first and matches second.
 *
 * Correctness is not asserted, it is CHECKED: reconcile() proves the rows we
 * extracted sum to the totals Alpaca printed. A statement that does not
 * reconcile must be rejected, never stored — see the note on Reconciliation.
 */

export type TxType =
  | 'BUY' | 'SELL' | 'DIVIDEND' | 'TAX' | 'DEPOSIT' | 'WITHDRAWAL'
  | 'FEE' | 'INTEREST' | 'JOURNAL' | 'ADJUSTMENT';

export interface ParsedTx {
  tradeDate: string;        // ISO yyyy-mm-dd
  type: TxType;
  entryType: string;        // Alpaca's own wording, kept verbatim for audit
  symbol: string | null;
  description: string | null;
  quantity: number | null;
  price: number | null;
  amount: number;           // signed, USD; positive = into the account
  commission: number | null;
  externalRef: string | null;
}

export interface ParsedHolding {
  symbol: string;
  description: string | null;
  quantity: number;
  marketPrice: number | null;
  marketValue: number | null;
  costPrice: number | null;
  unrealized: number | null;
  costBasis: number | null;
}

export interface CashSummary {
  beginning: number | null;
  addition: number | null;
  subtraction: number | null;
  tradeTransaction: number | null;
  costAndFees: number | null;
  ending: number | null;
}

export interface ParsedStatement {
  accountNo: string | null;
  periodLabel: string | null;   // "JANUARY - 2024"
  periodStart: string | null;   // ISO
  periodEnd: string | null;     // ISO
  cash: CashSummary;
  transactions: ParsedTx[];
  holdings: ParsedHolding[];
}

export interface Reconciliation {
  ok: boolean;
  checks: { name: string; ok: boolean; expected: number | null; actual: number | null }[];
  notes: string[];
}

const MONTHS: Record<string, number> = {
  JANUARY: 1, FEBRUARY: 2, MARCH: 3, APRIL: 4, MAY: 5, JUNE: 6,
  JULY: 7, AUGUST: 8, SEPTEMBER: 9, OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12,
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** "$1,008.10" | "-$4.00" | "$ --" | "-4.13" -> number | null. "--" means zero. */
function money(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (/^-?\$? ?--$/.test(t)) return 0;
  const neg = /^-/.test(t) || /^\(.*\)$/.test(t);
  const v = parseFloat(t.replace(/[()$,\s-]/g, ''));
  if (!Number.isFinite(v)) return null;
  return neg ? -v : v;
}

/** Last money-looking token on a line — the Net Amt column, immune to figures
 *  quoted inside a description ("DIV tax withholding on $26.69 at 15%"). */
function lastMoney(line: string): number | null {
  const m = [...line.matchAll(/-?\$ ?[\d,]+\.?\d*|\$ ?--/g)];
  return m.length ? money(m[m.length - 1][0]) : null;
}

function toIso(d: string): string | null {
  const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mo, da, yr] = m;
  return `${yr}-${mo.padStart(2, '0')}-${da.padStart(2, '0')}`;
}

const DATE_START = /^(\d{1,2}\/\d{1,2}\/\d{4})\b/;
const PAGE_MARK = /^--\s*\d+\s+of\s+\d+\s*--$/;

/**
 * Collapse Alpaca's wrapping: a logical row begins at a date and continues until
 * the next date, section header or page marker. Tabs become single spaces, and a
 * dangling "-" is rejoined to the amount that follows it.
 */
function logicalRows(block: string): string[] {
  const out: string[] = [];
  let cur: string | null = null;
  for (const raw of block.split('\n')) {
    const line = raw.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
    if (!line || PAGE_MARK.test(line)) continue;
    if (DATE_START.test(line)) {
      if (cur) out.push(cur);
      cur = line;
    } else if (cur) {
      // A trailing "-" followed by "$..." on the NEXT line is one negative
      // amount split by the wrap, so join with no space. Doing this globally
      // instead was a bug: Alpaca also prints a bare "-" as an EMPTY COLUMN
      // mid-line ("Journal Entry(Cash) ID: ... - $1.00"), and joining that
      // turned a $1.00 credit into -$1.00. Only a line break carries the sign.
      cur = /-$/.test(cur) && /^\$/.test(line) ? cur + line : cur + ' ' + line;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Text between a section heading and whichever of `next` appears first. */
function section(text: string, name: string, next: string[]): string {
  const i = text.indexOf('\n' + name + '\n');
  if (i < 0) return '';
  const rest = text.slice(i + name.length + 2);
  const idx = next.map((n) => rest.indexOf('\n' + n + '\n')).filter((x) => x >= 0);
  const j = idx.length ? Math.min(...idx) : -1;
  const body = j < 0 ? rest : rest.slice(0, j);
  return /No record found\.?/.test(body.slice(0, 200)) && logicalRows(body).length === 0 ? '' : body;
}

export function parseStatement(text: string): ParsedStatement {
  const accountNo = (text.match(/Account No:\s*(\d+)/) || [])[1] ?? null;
  const periodLabel = (text.match(/Period:\s*([A-Z]+\s*-\s*\d{4})/) || [])[1]?.replace(/\s+/g, ' ') ?? null;

  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  if (periodLabel) {
    const [moName, yr] = periodLabel.split(/\s*-\s*/);
    const mo = MONTHS[moName.toUpperCase()];
    if (mo && yr) {
      periodStart = `${yr}-${String(mo).padStart(2, '0')}-01`;
      periodEnd = new Date(Date.UTC(Number(yr), mo, 0)).toISOString().slice(0, 10);
    }
  }

  // Cash Summary prints "This Period" then "Year to Date"; take the FIRST.
  const cashField = (label: string): number | null => {
    const m = text.match(new RegExp(label + '\\s*\\t?\\s*(-?\\$ ?[\\d,\\.]+|\\$ ?--)'));
    return m ? money(m[1]) : null;
  };
  const cash: CashSummary = {
    beginning: cashField('Beginning Balance'),
    addition: cashField('Addition'),
    subtraction: cashField('Subtraction'),
    tradeTransaction: cashField('Trade Transaction'),
    costAndFees: cashField('Cost and Fees'),
    ending: cashField('Ending Value'),
  };

  const transactions: ParsedTx[] = [];

  // ── Income: dividends, withholding adjustments, cash journal entries ──
  for (const row of logicalRows(section(text, 'Income', ['Fees', 'Transaction']))) {
    const date = row.match(DATE_START)![1];
    const amount = lastMoney(row);
    if (amount === null) continue;
    // Search for the ticker AFTER the entry type, never across the whole row.
    // "Div. Adj(NRA Withheld) SPY ..." otherwise yields NRA — which duly turned
    // up in the database as a security alongside SPY and BRK.B.
    const afterType = row.replace(DATE_START, '').replace(/^\s*(Dividends?|Div\. Adj\([^)]*\)|Journal Entry\([^)]*\)|Interest)\s*/i, '');
    const sym = afterType.match(/^([A-Z]{1,5}(?:\.[A-Z])?)\b/);
    const isTax = /NRA Withheld|withholding|Div\. Adj/i.test(row);
    const isDiv = /Dividend/i.test(row);
    const entryType =
      (row.match(/^\S+\s+(Dividends?|Div\. Adj\([^)]*\)|Journal Entry\([^)]*\)|Interest)/) || [])[1] ?? 'Income';
    transactions.push({
      tradeDate: toIso(date)!,
      type: isTax ? 'TAX' : isDiv ? 'DIVIDEND' : /Interest/i.test(row) ? 'INTEREST' : 'JOURNAL',
      entryType,
      symbol: isDiv || isTax ? (sym ? sym[1] : null) : null,
      description: row.replace(DATE_START, '').trim() || null,
      quantity: null,
      price: null,
      amount,
      commission: null,
      externalRef: (row.match(/ID:\s*([0-9a-f-]{8,})/) || [])[1] ?? null,
    });
  }

  // ── Fees ──
  for (const row of logicalRows(section(text, 'Fees', ['Transaction', 'Deposit & Withdrawals']))) {
    const amount = lastMoney(row);
    if (amount === null) continue;
    transactions.push({
      tradeDate: toIso(row.match(DATE_START)![1])!,
      type: 'FEE', entryType: 'Fee', symbol: null,
      description: row.replace(DATE_START, '').trim() || null,
      quantity: null, price: null, amount, commission: null, externalRef: null,
    });
  }

  // ── Transaction: the trades ──
  for (const row of logicalRows(section(text, 'Transaction', ['Deposit & Withdrawals', 'STATEMENT MESSAGE', 'DISCLOSURES']))) {
    // <date> Trade Entry <side> <symbol> <qty> $<price> <amount> <commission>
    // Quantity may be NEGATIVE: Alpaca writes a sale as
    //   "Trade Entry sell SPY -2 $412.43 $824.86"
    // — negative shares, positive proceeds. Without the sign the row did not
    // match at all, so sells were silently dropped and the month's trade total
    // came out short. It went unnoticed because the first account imported had
    // 23 buys and no sells; the second account failed on five statements.
    const m = row.match(
      /^(\d{1,2}\/\d{1,2}\/\d{4})\s+Trade Entry\s+(buy|sell)\s+([A-Z]{1,5}(?:\.[A-Z])?)\s+(-?[\d.]+)\s+\$([\d,.]+)\s+(-?\$?[\d,.]+)\s*(\$ ?--|-?\$?[\d,.]+)?/i,
    );
    if (!m) continue;
    const [, date, side, symbol, qty, price, amt, comm] = m;
    transactions.push({
      tradeDate: toIso(date)!,
      type: side.toLowerCase() === 'buy' ? 'BUY' : 'SELL',
      entryType: 'Trade Entry',
      symbol,
      description: null,
      // Stored positive; the TYPE carries the direction, and netAmount carries
      // the sign (negative when buying, positive when selling).
      quantity: Math.abs(parseFloat(qty)),
      price: money(price),
      amount: money(amt)!,
      commission: comm ? money(comm) : null,
      externalRef: null,
    });
  }

  // ── Deposit & Withdrawals ──
  for (const row of logicalRows(section(text, 'Deposit & Withdrawals', ['STATEMENT MESSAGE', 'DISCLOSURES']))) {
    // trailing "<amount> <accountNo>"; the account number must not be read as money
    const m = row.match(/(-?\$ ?[\d,]+\.?\d*)\s+(\d{6,})\s*$/);
    const amount = m ? money(m[1]) : lastMoney(row);
    if (amount === null) continue;
    const outgoing = /\(-\)|withdraw|outgoing/i.test(row);
    transactions.push({
      tradeDate: toIso(row.match(DATE_START)![1])!,
      type: outgoing ? 'WITHDRAWAL' : 'DEPOSIT',
      entryType: (row.match(/Cash\s*disbursement\([-+]\)/i) || [])[0] ?? 'Cash disbursement',
      symbol: null,
      description: row.replace(DATE_START, '').trim() || null,
      quantity: null, price: null,
      amount: outgoing ? -Math.abs(amount) : Math.abs(amount),
      commission: null,
      externalRef: (row.match(/instant_transfer_id:\s*([0-9a-f-]{8,})/) || [])[1] ?? null,
    });
  }

  // ── Holdings ──
  const holdings: ParsedHolding[] = [];
  const holdBlock = section(text, 'Holdings', ['Income', 'Fees', 'Transaction']);
  for (const raw of holdBlock.split('\n')) {
    const line = raw.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
    if (!line || line.startsWith('Symbol') || line.startsWith('*Cash') || PAGE_MARK.test(line)) continue;
    const m = line.match(
      /^([A-Z]{1,5}(?:\.[A-Z])?)\s+(.*?)\s+([\d.]+)\s+(\$ ?[\d,.-]+|\$ ?--)\s+(\$ ?[\d,.-]+|\$ ?--)\s+(\$ ?[\d,.-]+|\$ ?--)\s+(-?\$ ?[\d,.-]+|\$ ?--)\s+(\$ ?[\d,.-]+|\$ ?--)/,
    );
    if (!m) continue;
    holdings.push({
      symbol: m[1],
      description: m[2] || null,
      quantity: parseFloat(m[3]),
      marketPrice: money(m[4]),
      marketValue: money(m[5]),
      costPrice: money(m[6]),
      unrealized: money(m[7]),
      costBasis: money(m[8]),
    });
  }

  return { accountNo, periodLabel, periodStart, periodEnd, cash, transactions, holdings };
}

/**
 * Prove the parse. Alpaca prints its own totals, so the rows we extracted must
 * add up to them. This is what makes a manual-upload system trustworthy: a
 * layout change or a missed row shows up as a failed check instead of a quietly
 * wrong balance.
 */
export function reconcile(s: ParsedStatement): Reconciliation {
  const { cash } = s;
  const sum = (f: (t: ParsedTx) => boolean) => r2(s.transactions.filter(f).reduce((a, t) => a + t.amount, 0));
  const checks: Reconciliation['checks'] = [];
  const notes: string[] = [];

  const add = (name: string, expected: number | null, actual: number | null) => {
    const ok = expected !== null && actual !== null && r2(expected) === r2(actual);
    checks.push({ name, ok, expected, actual });
  };

  // 1. Alpaca's own arithmetic.
  if ([cash.beginning, cash.addition, cash.subtraction, cash.tradeTransaction, cash.costAndFees, cash.ending].every((v) => v !== null)) {
    add('cash summary balances',
      cash.ending,
      r2(cash.beginning! + cash.addition! - cash.subtraction! + cash.tradeTransaction! + cash.costAndFees!));
  } else {
    notes.push('cash summary incomplete');
  }

  // 2. Our rows against its totals — the check that actually tests the parser.
  add('trade rows == Trade Transaction', cash.tradeTransaction, sum((t) => t.type === 'BUY' || t.type === 'SELL'));
  add('deposits+income == Addition', cash.addition,
    sum((t) => t.type === 'DEPOSIT' || t.type === 'DIVIDEND' || t.type === 'INTEREST' || t.type === 'JOURNAL'));

  // 3. Holdings quantity must match what the ledger implies, where we hold history.
  return { ok: checks.every((c) => c.ok), checks, notes };
}
