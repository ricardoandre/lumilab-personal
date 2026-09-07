import { prisma } from '@/lib/prisma';
import { goldPrice } from '@/lib/gold';

const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const num = (v: unknown) => (v == null ? 0 : Number(v));

export interface GoldLot {
  id: string;
  date: string;
  remarks: string | null;
  grams: number;
  pricePerGram: number;
  total: number;
  valueNow: number;
  gain: number;
  returnPct: number | null;
}

export interface GoldOverview {
  grams: number;
  invested: number;
  valueNow: number;
  gain: number;
  simpleReturn: number | null;
  annualised: number | null;
  irr: number | null;
  pricePerGram: number | null;
  priceFetchedAt: string | null;
  priceStale: boolean;
  firstPurchase: string | null;
  byOwner: { owner: string; grams: number; invested: number; valueNow: number; gain: number }[];
  lots: GoldLot[];
}

/**
 * Gold has no statements, so unlike Gotrade there is no month-end history to
 * chain — only purchases and one current price. Return is therefore measured the
 * two ways that CAN be measured honestly: simple (what it grew by) and IRR
 * (which uses each purchase's actual date, so a 2016 lot is not treated the same
 * as one bought last month).
 */
export async function goldOverview(accountId: bigint): Promise<GoldOverview> {
  const [txs, price] = await Promise.all([
    prisma.transaction.findMany({
      where: { accountId, type: 'BUY' },
      orderBy: [{ tradeDate: 'desc' }, { id: 'desc' }],
    }),
    goldPrice(),
  ]);

  const perGram = price?.idrPerGram ?? null;
  const lots: GoldLot[] = txs.map((t) => {
    const grams = num(t.quantity);
    const total = Math.abs(num(t.netAmount));
    const valueNow = perGram === null ? 0 : r2(grams * perGram);
    const gain = perGram === null ? 0 : r2(valueNow - total);
    return {
      id: String(t.id),
      date: t.tradeDate.toISOString().slice(0, 10),
      remarks: t.description,
      grams,
      pricePerGram: num(t.price),
      total,
      valueNow,
      gain,
      returnPct: perGram === null || total <= 0 ? null : r4(gain / total),
    };
  });

  const grams = r2(lots.reduce((a, l) => a + l.grams, 0));
  const invested = r2(lots.reduce((a, l) => a + l.total, 0));
  const valueNow = perGram === null ? 0 : r2(grams * perGram);
  const gain = r2(valueNow - invested);

  // Whose gold is whose — the remarks are the only thing that says.
  const owners = new Map<string, { grams: number; invested: number }>();
  for (const l of lots) {
    const key = (l.remarks ?? 'Unspecified').trim() || 'Unspecified';
    const cur = owners.get(key) ?? { grams: 0, invested: 0 };
    owners.set(key, { grams: cur.grams + l.grams, invested: cur.invested + l.total });
  }
  const byOwner = [...owners.entries()]
    .map(([owner, v]) => {
      const vn = perGram === null ? 0 : r2(v.grams * perGram);
      return { owner, grams: r2(v.grams), invested: r2(v.invested), valueNow: vn, gain: r2(vn - v.invested) };
    })
    .sort((a, b) => b.valueNow - a.valueNow);

  const oldest = lots.length ? lots[lots.length - 1].date : null;
  const years = oldest ? (Date.now() - new Date(oldest).getTime()) / (365.25 * 24 * 3600 * 1000) : null;

  // IRR over the real purchase dates, with today's value as the closing inflow.
  let irr: number | null = null;
  if (lots.length && perGram !== null && valueNow > 0) {
    const { xirr } = await import('@/lib/gotrade/report');
    irr = xirr([
      ...lots.map((l) => ({ date: new Date(l.date), amount: -l.total })),
      { date: new Date(), amount: valueNow },
    ]);
  }

  return {
    grams,
    invested,
    valueNow,
    gain,
    simpleReturn: invested > 0 ? r4(gain / invested) : null,
    // Simple return spread over the holding period; IRR is the better figure
    // here and is shown beside it.
    annualised: invested > 0 && years && years >= 0.25 ? r4(Math.pow(1 + gain / invested, 1 / years) - 1) : null,
    irr,
    pricePerGram: perGram,
    priceFetchedAt: price ? price.fetchedAt.toISOString().slice(0, 16).replace('T', ' ') : null,
    priceStale: price?.stale ?? false,
    firstPurchase: oldest,
    byOwner,
    lots,
  };
}
