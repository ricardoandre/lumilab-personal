/**
 * Seed the Gold account from Andre's list.
 *
 * No schema change: gold fits the existing Account / Security / Transaction
 * shape exactly — grams are the quantity, IDR per gram is the price, and the
 * owner name goes in description. Inventing a parallel set of tables for it
 * would have meant a second reporting path for the same arithmetic.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import crypto from 'node:crypto';
import 'dotenv/config';

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.APP_DB_URL) });

// date, remarks (whose it is), grams, TOTAL PAID in IDR.
//
// The TOTAL is authoritative, not the price per gram, and price is derived from
// it. Two rows prove why: 3.96 g at a quoted 1,400,000 comes to 5,544,000, but
// Andre actually paid 5,550,000 — a fee or a rounding at the counter. Deriving
// the total from the quoted price would have quietly understated what he spent.
const ROWS = [
  ['2016-03-01', 'ANDRE',   377.21, 188605000],
  ['2024-10-22', 'KIDS',     40.00,  54000000],
  ['2024-10-30', 'LISA',     40.00,  55800000],
  ['2024-10-31', 'LISA',     40.00,  55880000],
  ['2024-10-31', 'LISA',     40.00,  56000000],
  ['2024-11-02', 'LISA',     75.00, 104437500],
  ['2025-01-29', 'PATRICK',   3.96,   5550000],
  ['2025-01-29', 'NARA',      3.96,   5550000],
  ['2025-04-08', 'PATRICK',   7.50,  12337500],
  ['2025-04-08', 'KIDS',     15.00,  24675000],
  ['2025-09-26', 'LISA',     10.00,  19950000],
  ['2025-10-16', 'LISA',     10.00,  22470000],
  ['2025-10-24', 'LISA',     10.00,  22500000],
  ['2025-10-30', 'LISA',     10.00,  20930000],
  ['2025-11-19', 'KIDS',     10.00,  21790000],
  ['2026-01-17', 'LISA',     10.00,  24760000],
];

const provider = await prisma.fieldOption.upsert({
  where: { fieldKey_value: { fieldKey: 'account.provider', value: 'GOLD' } },
  update: { label: 'Gold', color: 'gold', sortOrder: 40 },
  create: { fieldKey: 'account.provider', value: 'GOLD', label: 'Gold', color: 'gold', sortOrder: 40 },
});

const existing = await prisma.account.findFirst({ where: { name: 'Gold' } });
const account = existing ?? await prisma.account.create({
  data: { name: 'Gold', providerId: provider.id, kind: 'COMMODITY', currency: 'IDR', sortOrder: 30 },
});

const security = (await prisma.security.findFirst({ where: { symbol: 'GOLD' } }))
  ?? await prisma.security.create({
    data: { symbol: 'GOLD', name: 'Gold (grams)', currency: 'IDR', assetType: 'COMMODITY' },
  });

let added = 0, skipped = 0;
for (const [date, remarks, grams, total] of ROWS) {
  const pricePerGram = Math.round((total / grams) * 100) / 100;
  const dedupeKey = crypto.createHash('sha1')
    .update([date, 'BUY', 'GOLD', grams, total, remarks].join('|')).digest('hex');

  if (await prisma.transaction.findFirst({ where: { accountId: account.id, dedupeKey }, select: { id: true } })) {
    skipped++; continue;
  }
  await prisma.transaction.create({
    data: {
      accountId: account.id,
      securityId: security.id,
      tradeDate: new Date(date),
      type: 'BUY',
      quantity: grams,
      price: pricePerGram,
      netAmount: -total,
      currency: 'IDR',
      description: remarks,
      dedupeKey,
    },
  });
  added++;
}

// Funding: gold is bought with money brought in, so each purchase is matched by
// a deposit of the same size. Without it every purchase would read as a loss of
// cash the account never held.
for (const [date, remarks, grams, total] of ROWS) {
  const dedupeKey = crypto.createHash('sha1')
    .update([date, 'DEPOSIT', 'GOLD-FUNDING', grams, total, remarks].join('|')).digest('hex');
  if (await prisma.transaction.findFirst({ where: { accountId: account.id, dedupeKey }, select: { id: true } })) continue;
  await prisma.transaction.create({
    data: {
      accountId: account.id, tradeDate: new Date(date), type: 'DEPOSIT',
      quantity: null, price: null, netAmount: total, currency: 'IDR',
      description: `Funding for ${remarks} purchase`, dedupeKey,
    },
  });
}

const grams = ROWS.reduce((a, r) => a + r[2], 0);
const paid = ROWS.reduce((a, r) => a + r[3], 0);
console.log(`  account #${account.id} "${account.name}" (${account.currency})`);
console.log(`  ${added} purchases added, ${skipped} already present`);
console.log(`  ${grams.toFixed(2)} g for Rp ${Math.round(paid).toLocaleString('id-ID')}`);
await prisma.$disconnect();
