import { prisma } from '@/lib/prisma';
import { usdToIdr } from '@/lib/fx';

/**
 * Gold price per GRAM in rupiah, cached like the exchange rate.
 *
 * Derived, not quoted directly: the free source gives world spot in USD per troy
 * ounce, which is then converted with the same USD/IDR rate the rest of the app
 * uses. Doing it in one place means the gold valuation and the net-worth
 * conversion can never disagree with each other.
 *
 * IMPORTANT CAVEAT, surfaced in the UI: this is WORLD SPOT. Indonesian retail
 * gold (Antam and similar) sells above spot and buys back below it, so a real
 * sale would fetch less than this figure suggests. It is the right number for
 * "what is my gold worth", not for "what would I get today".
 */
const SETTING_KEY = 'gold.idr_per_gram';
const GRAMS_PER_TROY_OUNCE = 31.1034768;
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export interface GoldPrice {
  idrPerGram: number;
  usdPerOunce: number;
  fetchedAt: Date;
  stale: boolean;
}

async function readCached(): Promise<Omit<GoldPrice, 'stale'> | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!row) return null;
  try {
    const p = JSON.parse(row.value) as { idrPerGram: number; usdPerOunce: number; fetchedAt: string };
    if (!Number.isFinite(p.idrPerGram) || p.idrPerGram <= 0) return null;
    return { ...p, fetchedAt: new Date(p.fetchedAt) };
  } catch {
    return null;
  }
}

export async function goldPrice(): Promise<GoldPrice | null> {
  const cached = await readCached();
  if (cached && Date.now() - cached.fetchedAt.getTime() < MAX_AGE_MS) {
    return { ...cached, stale: false };
  }

  try {
    const [res, fx] = await Promise.all([
      fetch('https://api.gold-api.com/price/XAU', { signal: AbortSignal.timeout(8000), cache: 'no-store' }),
      usdToIdr(),
    ]);
    if (!res.ok || !fx) throw new Error('no quote');
    const body = (await res.json()) as { price?: number };
    const usdPerOunce = body.price;
    if (!usdPerOunce || !Number.isFinite(usdPerOunce)) throw new Error('no price');

    const idrPerGram = (usdPerOunce / GRAMS_PER_TROY_OUNCE) * fx.rate;
    const now = new Date();
    const value = JSON.stringify({ idrPerGram, usdPerOunce, fetchedAt: now.toISOString() });
    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY },
      update: { value },
      create: { key: SETTING_KEY, group: 'gold', label: 'Gold, IDR per gram', valueType: 'json', value },
    });
    return { idrPerGram, usdPerOunce, fetchedAt: now, stale: false };
  } catch {
    // A price source outage must not blank the holding's value.
    return cached ? { ...cached, stale: true } : null;
  }
}
