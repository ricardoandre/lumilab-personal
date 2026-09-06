import crypto from 'node:crypto';
import { parseStatement, reconcile, type ParsedTx } from './parse-statement.ts';
import { put, statementKey } from '../storage.ts';

/** Minimal shape we need from the app's Prisma client. */
type Db = any;

export interface ImportResult {
  importId: string;
  status: 'ok' | 'failed' | 'duplicate';
  periodLabel: string | null;
  reconciled: boolean;
  rowsParsed: number;
  rowsInserted: number;
  rowsSkipped: number;
  holdings: number;
  error?: string;
}

const sha256 = (buf: Buffer) => crypto.createHash('sha256').update(buf).digest('hex');

/**
 * Deterministic identity for a ledger row.
 *
 * Includes `occurrence`, the row's index among otherwise-identical rows in the
 * same statement, because Alpaca genuinely prints repeats: 2022-06-16 has two
 * SPY buys of 1 share at $366.09 and $366.10 — near-identical, and a same-price
 * pair is entirely possible. Without it the second row would collide with the
 * first and be silently dropped as a duplicate, quietly understating a position.
 */
function dedupeKey(t: ParsedTx, occurrence: number): string {
  return crypto
    .createHash('sha1')
    .update([t.tradeDate, t.type, t.symbol ?? '', t.quantity ?? '', t.price ?? '', t.amount, occurrence].join('|'))
    .digest('hex');
}

async function securityId(db: Db, symbol: string, description: string | null): Promise<bigint> {
  const existing = await db.security.findFirst({ where: { symbol, exchange: null } });
  if (existing) {
    if (!existing.name && description) {
      await db.security.update({ where: { id: existing.id }, data: { name: description } });
    }
    return existing.id;
  }
  return (await db.security.create({ data: { symbol, name: description, currency: 'USD' } })).id;
}

/**
 * Import one Gotrade monthly statement.
 *
 * Two independent guards against double-counting, because the whole system is
 * fed by hand and overlapping uploads are normal:
 *   1. fileChecksum — re-uploading the identical file is a no-op.
 *   2. dedupeKey    — the same transaction arriving inside a DIFFERENT file
 *                     (a re-issued statement, an overlapping export) inserts nothing.
 *
 * A statement that does not reconcile is recorded with status 'failed' and its
 * transactions are NOT stored. Storing rows we cannot prove complete is worse
 * than storing none: a wrong balance looks exactly like a right one.
 */
export async function importStatement(
  db: Db,
  opts: { accountId: bigint; fileName: string; buffer: Buffer; text: string },
): Promise<ImportResult> {
  const { accountId, fileName, buffer, text } = opts;
  const checksum = sha256(buffer);

  // Only a SUCCESSFUL earlier import makes this a duplicate.
  //
  // A failed one must not block a retry: September 2025 failed, its record kept
  // the checksum, and re-uploading the very same file was waved away as
  // "already imported" — so the fix could never be tested and, because this
  // check runs before storage, the file was not even kept the second time.
  // A refused statement is precisely the one most likely to be uploaded again.
  const already = await db.statementImport.findFirst({
    where: { accountId, fileChecksum: checksum, status: 'ok' },
  });
  if (already) {
    return {
      importId: String(already.id), status: 'duplicate', periodLabel: null,
      reconciled: already.reconciled, rowsParsed: already.rowsParsed,
      rowsInserted: 0, rowsSkipped: already.rowsParsed, holdings: 0,
    };
  }

  // Clear any previous FAILED attempt at this same file, so the retry can write
  // its own record (fileChecksum is unique per account).
  await db.statementImport.deleteMany({ where: { accountId, fileChecksum: checksum, status: { not: 'ok' } } });

  // Keep the ORIGINAL file, always — not only on success.
  // September 2025 failed reconciliation by $0.18 and could not be investigated,
  // because the upload existed only for the length of the request. A parser this
  // strict WILL refuse statements, and every refusal is a bug report that is
  // useless without the document that caused it. Storing it also means a parser
  // fix can be re-run over past uploads instead of asking for them again.
  let storageKey: string | null = null;
  try {
    storageKey = await put(statementKey(accountId, checksum), buffer);
  } catch {
    // Storage must never block an import: a full disk should cost us the audit
    // copy, not the data.
    storageKey = null;
  }

  const parsed = parseStatement(text);
  const recon = reconcile(parsed);
  const failed = recon.checks.filter((c) => !c.ok);
  const note = failed.length
    ? failed.map((c) => `${c.name}: expected ${c.expected}, got ${c.actual}`).join('; ')
    : recon.notes.join('; ') || null;

  // WHOSE statement is this? Every Gotrade statement prints its account number.
  // With more than one Gotrade account, uploading Andre's December into Lisa's
  // account would otherwise succeed silently and corrupt both — her balances
  // would include his trades, and nothing on screen would say so.
  //
  // First upload CLAIMS the number for an account that has none; after that a
  // mismatch is refused outright.
  const account = await db.account.findUnique({ where: { id: accountId } });
  if (parsed.accountNo) {
    if (!account?.externalAccountNo) {
      await db.account.update({ where: { id: accountId }, data: { externalAccountNo: parsed.accountNo } });
    } else if (account.externalAccountNo !== parsed.accountNo) {
      return {
        importId: '', status: 'failed', periodLabel: parsed.periodLabel, reconciled: false,
        rowsParsed: 0, rowsInserted: 0, rowsSkipped: 0, holdings: 0,
        error: `This statement is for account ${parsed.accountNo}, but ${account.name} is account ${account.externalAccountNo}. Nothing was imported.`,
      };
    }
  }

  const imp = await db.statementImport.create({
    data: {
      accountId,
      fileName,
      fileChecksum: checksum,
      kind: 'STATEMENT',
      periodStart: parsed.periodStart ? new Date(parsed.periodStart) : null,
      periodEnd: parsed.periodEnd ? new Date(parsed.periodEnd) : null,
      rowsParsed: parsed.transactions.length,
      beginningBalance: parsed.cash.beginning,
      additionTotal: parsed.cash.addition,
      subtractionTotal: parsed.cash.subtraction,
      tradeTotal: parsed.cash.tradeTransaction,
      feeTotal: parsed.cash.costAndFees,
      endingBalance: parsed.cash.ending,
      reconciled: recon.ok,
      reconcileNote: note,
      storageKey,
      status: recon.ok ? 'ok' : 'failed',
    },
  });

  if (!recon.ok) {
    return {
      importId: String(imp.id), status: 'failed', periodLabel: parsed.periodLabel,
      reconciled: false, rowsParsed: parsed.transactions.length,
      rowsInserted: 0, rowsSkipped: 0, holdings: 0, error: note ?? 'did not reconcile',
    };
  }

  // occurrence index among identical rows within this statement
  const seen = new Map<string, number>();
  let inserted = 0;
  let skipped = 0;
  for (const t of parsed.transactions) {
    const base = [t.tradeDate, t.type, t.symbol ?? '', t.quantity ?? '', t.price ?? '', t.amount].join('|');
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);
    const key = dedupeKey(t, occurrence);

    if (await db.transaction.findFirst({ where: { accountId, dedupeKey: key }, select: { id: true } })) {
      skipped++;
      continue;
    }
    await db.transaction.create({
      data: {
        accountId,
        importId: imp.id,
        securityId: t.symbol ? await securityId(db, t.symbol, null) : null,
        tradeDate: new Date(t.tradeDate),
        type: t.type,
        quantity: t.quantity,
        price: t.price,
        fee: t.commission,
        netAmount: t.amount,
        currency: 'USD',
        description: t.description,
        externalRef: t.externalRef,
        dedupeKey: key,
      },
    });
    inserted++;
  }

  // Holdings: the ONLY month-end price source we have, since there is no API.
  let holdings = 0;
  if (parsed.periodEnd) {
    for (const h of parsed.holdings) {
      const sid = await securityId(db, h.symbol, h.description);
      await db.statementHolding.upsert({
        where: { importId_securityId: { importId: imp.id, securityId: sid } },
        update: {},
        create: {
          importId: imp.id, securityId: sid, asOf: new Date(parsed.periodEnd),
          quantity: h.quantity, marketPrice: h.marketPrice, marketValue: h.marketValue,
          costPrice: h.costPrice, unrealized: h.unrealized, costBasis: h.costBasis,
        },
      });
      holdings++;
    }
  }

  await db.statementImport.update({
    where: { id: imp.id },
    data: { rowsInserted: inserted, rowsSkipped: skipped },
  });

  return {
    importId: String(imp.id), status: 'ok', periodLabel: parsed.periodLabel, reconciled: true,
    rowsParsed: parsed.transactions.length, rowsInserted: inserted, rowsSkipped: skipped, holdings,
  };
}
