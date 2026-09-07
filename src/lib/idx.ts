import { prisma } from '@/lib/prisma';

/**
 * Live prices for Indonesian shares, cached.
 *
 * IPOT's monthly statement carries no prices at all — only its portfolio export
 * does, and Andre's newest is from December 2023. Pricing the position live
 * replaces a 32-month-old valuation, over which SIDO alone fell from Rp 865 to
 * Rp 356.
 *
 * Cached for the trading day and served stale on failure: a quote provider's
 * outage must not blank a portfolio.
 */
const SETTING_KEY = 'idx.prices';
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export interface IdxPrices {
  prices: Record<string, number>;
  fetchedAt: Date;
  stale: boolean;
  missing: string[];
}

async function readCached(): Promise<{ prices: Record<string, number>; fetchedAt: Date } | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!row) return null;
  try {
    const p = JSON.parse(row.value) as { prices: Record<string, number>; fetchedAt: string };
    if (!p.prices || typeof p.prices !== 'object') return null;
    return { prices: p.prices, fetchedAt: new Date(p.fetchedAt) };
  } catch {
    return null;
  }
}

async function quote(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}.JK?interval=1d&range=5d`,
      { signal: AbortSignal.timeout(8000), cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0' } },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { chart?: { result?: { meta?: { regularMarketPrice?: number; currency?: string } }[] } };
    const meta = body.chart?.result?.[0]?.meta;
    // Refuse a quote that is not in rupiah rather than silently mixing units.
    if (!meta || meta.currency !== 'IDR') return null;
    const px = meta.regularMarketPrice;
    return typeof px === 'number' && Number.isFinite(px) && px > 0 ? px : null;
  } catch {
    return null;
  }
}

export async function idxPrices(symbols: string[]): Promise<IdxPrices | null> {
  const wanted = [...new Set(symbols.map((s) => s.toUpperCase()))].sort();
  const cached = await readCached();

  const fresh = cached && Date.now() - cached.fetchedAt.getTime() < MAX_AGE_MS;
  const covered = cached && wanted.every((s) => cached.prices[s] !== undefined);
  if (fresh && covered) {
    return { prices: cached!.prices, fetchedAt: cached!.fetchedAt, stale: false, missing: [] };
  }

  const prices: Record<string, number> = { ...(cached?.prices ?? {}) };
  const missing: string[] = [];
  for (const s of wanted) {
    const px = await quote(s);
    if (px === null) missing.push(s);
    else prices[s] = px;
  }

  // Every symbol failed and nothing was cached — say so rather than pretending.
  if (!Object.keys(prices).length) return cached ? { ...cached, stale: true, missing: wanted } : null;

  const now = new Date();
  const value = JSON.stringify({ prices, fetchedAt: now.toISOString() });
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value },
    create: { key: SETTING_KEY, group: 'prices', label: 'IDX last prices', valueType: 'json', value },
  });
  return { prices, fetchedAt: now, stale: missing.length === wanted.length, missing };
}
