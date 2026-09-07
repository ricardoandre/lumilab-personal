import { prisma } from '@/lib/prisma';
import { idxPrices } from '@/lib/idx';

const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const num = (v: unknown) => (v == null ? 0 : Number(v));

export interface LivePosition {
  symbol: string;
  name: string | null;
  quantity: number;
  costBasis: number;
  price: number | null;
  marketValue: number;
  unrealized: number;
  returnPct: number | null;
  weightPct: number;
  /** True when this holding's quantity came from the snapshot and was not traded since. */
  carried: boolean;
}

export interface LivePortfolio {
  positions: LivePosition[];
  holdingsValue: number;
  cash: number;
  totalValue: number;
  /** Snapshot the share COUNTS start from. */
  anchoredAt: string | null;
  /** When the prices were fetched, and whether they are live. */
  pricedAt: string | null;
  pricesStale: boolean;
  missingPrices: string[];
  tradesSinceAnchor: number;
}

/**
 * What the account holds TODAY, priced at market.
 *
 * Share counts come from the newest portfolio snapshot plus every trade since —
 * because the monthly statement is a cash ledger and lists no positions. Prices
 * come from the market.
 *
 * THE KNOWN LIMIT, surfaced in the UI: a corporate action moves no cash, so it
 * never appears in a cash ledger. Andre's BMRI went from 4,000 shares to 8,000
 * between two snapshots with no trade recorded anywhere — Bank Mandiri's 1:2
 * split in April 2023. Nothing here can detect that; only a newer snapshot can.
 * Trades ARE visible and are applied.
 */
export async function livePortfolio(accountId: bigint): Promise<LivePortfolio | null> {
  const anchor = await prisma.statementImport.findFirst({
    where: { accountId, status: 'ok', holdings: { some: {} } },
    orderBy: { periodEnd: 'desc' },
    include: { holdings: { include: { security: true } } },
  });
  if (!anchor?.periodEnd) return null;

  /**
   * Only for accounts whose shares are listed in Jakarta.
   *
   * The quote source is IDX-only. Run against a Gotrade account it asks for
   * SPY.JK, gets nothing, and prices the whole position at zero — which is
   * exactly what happened: total net worth fell from Rp 4.6 bn to Rp 3.3 bn
   * because two dollar accounts were quietly valued at their cash alone.
   *
   * Gotrade needs none of this anyway: its statements carry prices every month.
   */
  const idxOnly = anchor.holdings.length > 0
    && anchor.holdings.every((h) => h.security.exchange === 'IDX');
  if (!idxOnly) return null;

  const latestStatement = await prisma.statementImport.findFirst({
    where: { accountId, status: 'ok', kind: 'STATEMENT' },
    orderBy: { periodEnd: 'desc' },
    select: { endingBalance: true },
  });

  const trades = await prisma.transaction.findMany({
    where: { accountId, type: { in: ['BUY', 'SELL'] }, tradeDate: { gt: anchor.periodEnd } },
    include: { security: true },
  });

  const held = new Map<string, { name: string | null; qty: number; cost: number; traded: boolean }>();
  for (const h of anchor.holdings) {
    held.set(h.security.symbol, {
      name: h.security.name,
      qty: num(h.quantity),
      cost: num(h.costBasis),
      traded: false,
    });
  }
  for (const t of trades) {
    const sym = t.security?.symbol;
    if (!sym) continue;
    const cur = held.get(sym) ?? { name: t.security?.name ?? null, qty: 0, cost: 0, traded: false };
    const qty = num(t.quantity);
    if (t.type === 'BUY') {
      cur.qty += qty;
      cur.cost += Math.abs(num(t.netAmount));
    } else {
      // Sold: reduce the position and its cost proportionally, so what remains
      // keeps the average price it was bought at.
      const share = cur.qty > 0 ? Math.min(1, qty / cur.qty) : 1;
      cur.cost = r2(cur.cost * (1 - share));
      cur.qty -= qty;
    }
    cur.traded = true;
    held.set(sym, cur);
  }

  for (const [sym, v] of [...held.entries()]) if (v.qty <= 0.0001) held.delete(sym);

  const symbols = [...held.keys()];
  const quotes = symbols.length ? await idxPrices(symbols) : null;

  const positions: LivePosition[] = symbols.map((sym) => {
    const v = held.get(sym)!;
    const price = quotes?.prices[sym] ?? null;
    const marketValue = price === null ? 0 : r2(v.qty * price);
    return {
      symbol: sym,
      name: v.name,
      quantity: v.qty,
      costBasis: r2(v.cost),
      price,
      marketValue,
      unrealized: price === null ? 0 : r2(marketValue - v.cost),
      returnPct: price === null || v.cost <= 0 ? null : r4((marketValue - v.cost) / v.cost),
      weightPct: 0,
      carried: !v.traded,
    };
  });

  const cash = num(latestStatement?.endingBalance);
  const holdingsValue = r2(positions.reduce((a, p) => a + p.marketValue, 0));
  const totalValue = r2(holdingsValue + cash);
  for (const p of positions) p.weightPct = totalValue > 0 ? r4(p.marketValue / totalValue) : 0;
  positions.sort((a, b) => b.marketValue - a.marketValue);

  return {
    positions,
    holdingsValue,
    cash,
    totalValue,
    anchoredAt: anchor.periodEnd.toISOString().slice(0, 10),
    pricedAt: quotes ? quotes.fetchedAt.toISOString().slice(0, 16).replace('T', ' ') : null,
    pricesStale: quotes?.stale ?? true,
    missingPrices: quotes?.missing ?? symbols,
    tradesSinceAnchor: trades.length,
  };
}
