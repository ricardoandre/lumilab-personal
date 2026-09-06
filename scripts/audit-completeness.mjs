/**
 * Is anything missing?
 *
 * Three independent questions, because each catches what the others cannot:
 *   1. Does every statement's own arithmetic tie out?  (parser correctness)
 *   2. Is any MONTH absent from the sequence?           (missing uploads)
 *   3. Does each month open where the last one closed?  (missing rows within a month)
 * Reconciliation alone answers only the first, and passed 46/46 while sells
 * were being dropped in another account.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.APP_DB_URL) });
const r2 = (n) => Math.round(n * 100) / 100;
const num = (v) => (v == null ? 0 : Number(v));

for (const account of await prisma.account.findMany({ orderBy: { sortOrder: 'asc' } })) {
  const imps = await prisma.statementImport.findMany({
    where: { accountId: account.id, status: 'ok' },
    orderBy: { periodEnd: 'asc' },
  });
  const failed = await prisma.statementImport.count({ where: { accountId: account.id, status: 'failed' } });
  const txCount = await prisma.transaction.count({ where: { accountId: account.id } });

  console.log(`\n${account.name}`);
  if (!imps.length) { console.log('  no statements'); continue; }

  const periods = imps.map((i) => i.periodEnd.toISOString().slice(0, 7));
  console.log(`  ${imps.length} statements, ${txCount} transactions, ${failed} failed`);
  console.log(`  covering ${periods[0]} -> ${periods[periods.length - 1]}`);

  // 2. missing months
  const missing = [];
  const [y0, m0] = periods[0].split('-').map(Number);
  const [y1, m1] = periods[periods.length - 1].split('-').map(Number);
  const have = new Set(periods);
  for (let y = y0, m = m0; y < y1 || (y === y1 && m <= m1); m === 12 ? (y++, m = 1) : m++) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    if (!have.has(key)) missing.push(key);
  }
  console.log(missing.length ? `  MISSING MONTHS (${missing.length}): ${missing.join(', ')}` : '  no missing months');

  // 3. balance chain
  const breaks = [];
  for (let i = 1; i < imps.length; i++) {
    const gap = r2(num(imps[i].beginningBalance) - num(imps[i - 1].endingBalance));
    if (Math.abs(gap) >= 0.005) {
      breaks.push({ from: periods[i - 1], to: periods[i], gap });
    }
  }
  if (!breaks.length) console.log('  balances chain cleanly month to month');
  else {
    console.log(`  BALANCE BREAKS (${breaks.length}):`);
    for (const b of breaks) {
      // withholding tax is excluded from Alpaca's Ending Value and reappears next month
      const tax = await prisma.transaction.aggregate({
        where: { accountId: account.id, type: 'TAX', tradeDate: { gte: new Date(`${b.from}-01`), lt: new Date(`${b.to}-01`) } },
        _sum: { netAmount: true },
      });
      const t = r2(num(tax._sum.netAmount));
      const explained = Math.abs(b.gap - t) < 0.005;
      console.log(`    ${b.from} -> ${b.to}  ${b.gap >= 0 ? '+' : ''}${b.gap}` +
        (explained ? `  (= withholding tax that month, expected)` : `   UNEXPLAINED`));
    }
  }
}
await prisma.$disconnect();
