import crypto from 'node:crypto';
import { parseIpotStatement, reconcileIpot } from './parse-statement.ts';
import { parseIpotPortfolio } from './parse-portfolio.ts';
import { put, statementKey } from '../storage.ts';

type Db = any;

export interface IpotImportResult {
  kind: 'statement' | 'portfolio' | 'unknown';
  status: 'ok' | 'duplicate' | 'failed';
  period: string | null;
  rowsInserted: number;
  rowsSkipped: number;
  holdings: number;
  error?: string;
}

const sha256 = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex');

async function securityId(db: Db, symbol: string, name: string | null): Promise<bigint> {
  const found = await db.security.findFirst({ where: { symbol, exchange: 'IDX' } });
  if (found) {
    if (!found.name && name) await db.security.update({ where: { id: found.id }, data: { name } });
    return found.id;
  }
  return (await db.security.create({
    data: { symbol, name, exchange: 'IDX', currency: 'IDR', assetType: 'STOCK' },
  })).id;
}

/**
 * IPOT ships TWO documents and they are not interchangeable: the monthly
 * statement is a cash ledger that never mentions a share price, and the
 * portfolio is a holdings snapshot with no transactions. One import path
 * handles both and routes on content rather than on the file name, which
 * varies (`.pdf.pdf`, a leading `202208`, no separator at all).
 */
export async function importIpotFile(
  db: Db,
  opts: { accountId: bigint; fileName: string; buffer: Buffer },
): Promise<IpotImportResult> {
  const { accountId, fileName, buffer } = opts;
  const checksum = sha256(buffer);

  const already = await db.statementImport.findFirst({
    where: { accountId, fileChecksum: checksum, status: 'ok' },
  });
  if (already) {
    return { kind: 'statement', status: 'duplicate', period: null, rowsInserted: 0, rowsSkipped: already.rowsParsed, holdings: 0 };
  }
  await db.statementImport.deleteMany({ where: { accountId, fileChecksum: checksum, status: { not: 'ok' } } });

  let storageKey: string | null = null;
  try { storageKey = await put(statementKey(accountId, checksum), buffer); } catch { storageKey = null; }

  // Route on content: a portfolio has holdings, a statement has a ledger.
  const portfolio = await parseIpotPortfolio(buffer).catch(() => null);
  if (portfolio && portfolio.holdings.length && portfolio.asOf) {
    const imp = await db.statementImport.create({
      data: {
        accountId, fileName, fileChecksum: checksum, kind: 'PORTFOLIO',
        periodStart: new Date(portfolio.asOf), periodEnd: new Date(portfolio.asOf),
        rowsParsed: portfolio.holdings.length,
        endingBalance: portfolio.cash,
        reconciled: true, storageKey, status: 'ok',
      },
    });
    for (const h of portfolio.holdings) {
      const sid = await securityId(db, h.symbol, h.name);
      await db.statementHolding.upsert({
        where: { importId_securityId: { importId: imp.id, securityId: sid } },
        update: {},
        create: {
          importId: imp.id, securityId: sid, asOf: new Date(portfolio.asOf),
          quantity: h.volume,
          marketPrice: h.close,
          marketValue: h.marketValue,
          costPrice: h.avgPrice,
          unrealized: h.unrealized,
          costBasis: h.costValue,
        },
      });
    }
    await db.statementImport.update({ where: { id: imp.id }, data: { rowsInserted: portfolio.holdings.length } });
    return {
      kind: 'portfolio', status: 'ok', period: portfolio.asOf,
      rowsInserted: 0, rowsSkipped: 0, holdings: portfolio.holdings.length,
    };
  }

  const stmt = await parseIpotStatement(buffer);
  if (!stmt.periodFrom) {
    return { kind: 'unknown', status: 'failed', period: null, rowsInserted: 0, rowsSkipped: 0, holdings: 0,
      error: 'Not an IPOT statement or portfolio.' };
  }

  const recon = reconcileIpot(stmt);
  const note = recon.ok ? null : `ledger ${recon.actual} vs printed closing ${recon.expected}`;

  // The statement's period runs to the settlement date in the NEXT month, so
  // the reporting month is the FROM date's month, not the TO date's.
  const periodStart = new Date(stmt.periodFrom);
  const periodEnd = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 0));

  const imp = await db.statementImport.create({
    data: {
      accountId, fileName, fileChecksum: checksum, kind: 'STATEMENT',
      periodStart, periodEnd,
      rowsParsed: stmt.transactions.length,
      beginningBalance: stmt.beginningBalance,
      endingBalance: stmt.endingBalance,
      reconciled: recon.ok,
      reconcileNote: note,
      storageKey,
      status: recon.ok ? 'ok' : 'failed',
    },
  });

  if (!recon.ok) {
    return { kind: 'statement', status: 'failed', period: stmt.periodFrom.slice(0, 7),
      rowsInserted: 0, rowsSkipped: 0, holdings: 0, error: note ?? 'did not reconcile' };
  }

  const seen = new Map<string, number>();
  let inserted = 0, skipped = 0;
  for (const t of stmt.transactions) {
    const base = [t.tradeDate, t.type, t.symbol ?? '', t.quantity ?? '', t.price ?? '', t.amount].join('|');
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);
    const dedupeKey = crypto.createHash('sha1').update(`${base}|${occurrence}`).digest('hex');

    if (await db.transaction.findFirst({ where: { accountId, dedupeKey }, select: { id: true } })) { skipped++; continue; }

    await db.transaction.create({
      data: {
        accountId, importId: imp.id,
        securityId: t.symbol ? await securityId(db, t.symbol, null) : null,
        tradeDate: new Date(t.tradeDate),
        settleDate: t.settleDate ? new Date(t.settleDate) : null,
        type: t.type,
        quantity: t.quantity,
        price: t.price,
        netAmount: t.amount,
        currency: 'IDR',
        description: t.description,
        externalRef: t.externalRef,
        dedupeKey,
      },
    });
    inserted++;
  }
  await db.statementImport.update({ where: { id: imp.id }, data: { rowsInserted: inserted, rowsSkipped: skipped } });

  return { kind: 'statement', status: 'ok', period: stmt.periodFrom.slice(0, 7), rowsInserted: inserted, rowsSkipped: skipped, holdings: 0 };
}
