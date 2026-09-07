import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import '@/engine.server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * Add or delete a gold purchase.
 *
 * Accepts EITHER a total paid or a price per gram and derives the other: Andre
 * asked to enter the total, but his own records are kept as price per gram, and
 * a form that takes only one of them forces mental arithmetic at the till.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  let accountId: bigint;
  try { accountId = BigInt(id); } catch { return NextResponse.json({ error: 'Bad account' }, { status: 400 }); }

  const body = await req.json().catch(() => ({}));
  const date = String(body.date ?? '');
  const grams = Number(body.grams);
  const remarks = String(body.remarks ?? '').trim();
  const totalIn = body.total === undefined || body.total === null || body.total === '' ? null : Number(body.total);
  const perGramIn = body.pricePerGram === undefined || body.pricePerGram === null || body.pricePerGram === '' ? null : Number(body.pricePerGram);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Pick a date.' }, { status: 400 });
  if (!Number.isFinite(grams) || grams <= 0) return NextResponse.json({ error: 'Weight must be more than zero.' }, { status: 400 });
  if (totalIn === null && perGramIn === null) {
    return NextResponse.json({ error: 'Enter either the total paid or the price per gram.' }, { status: 400 });
  }

  const total = totalIn !== null && Number.isFinite(totalIn) ? totalIn : Math.round(grams * (perGramIn as number) * 100) / 100;
  const pricePerGram = Math.round((total / grams) * 100) / 100;
  if (!Number.isFinite(total) || total <= 0) return NextResponse.json({ error: 'The amount must be more than zero.' }, { status: 400 });

  const security = (await prisma.security.findFirst({ where: { symbol: 'GOLD' } }))
    ?? await prisma.security.create({ data: { symbol: 'GOLD', name: 'Gold (grams)', currency: 'IDR', assetType: 'COMMODITY' } });

  const dedupeKey = crypto.createHash('sha1')
    .update([date, 'BUY', 'GOLD', grams, pricePerGram, remarks, Date.now()].join('|')).digest('hex');

  await prisma.transaction.create({
    data: {
      accountId, securityId: security.id, tradeDate: new Date(date), type: 'BUY',
      quantity: grams, price: pricePerGram, netAmount: -total, currency: 'IDR',
      description: remarks || null, dedupeKey,
    },
  });
  // Matching funding, so a purchase does not read as a loss of cash the account
  // never held — the same pairing the seeded rows use.
  await prisma.transaction.create({
    data: {
      accountId, tradeDate: new Date(date), type: 'DEPOSIT',
      netAmount: total, currency: 'IDR',
      description: remarks ? `Funding for ${remarks} purchase` : 'Funding for purchase',
      dedupeKey: dedupeKey + '-fund',
    },
  });

  return NextResponse.json({ ok: true, total, pricePerGram });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const txId = new URL(req.url).searchParams.get('tx');
  if (!txId) return NextResponse.json({ error: 'Which purchase?' }, { status: 400 });

  let accountId: bigint;
  let transactionId: bigint;
  try { accountId = BigInt(id); transactionId = BigInt(txId); }
  catch { return NextResponse.json({ error: 'Bad id' }, { status: 400 }); }

  const tx = await prisma.transaction.findFirst({ where: { id: transactionId, accountId } });
  if (!tx) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Remove the paired funding row too, or the account keeps phantom cash.
  await prisma.transaction.deleteMany({ where: { accountId, dedupeKey: `${tx.dedupeKey}-fund` } });
  await prisma.transaction.delete({ where: { id: transactionId } });
  return NextResponse.json({ ok: true });
}
