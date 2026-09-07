import { prisma } from '@/lib/prisma';

/**
 * USD → IDR, fetched daily and CACHED in app settings.
 *
 * Andre's decision (2026-09-06) is that balances stay in their own currency and
 * only the combined view converts, at the rate of the day. That makes the rate a
 * live dependency of the one number he most wants to see, so it must degrade
 * well: the last good rate is stored, and if the provider is unreachable the
 * page shows that rate with its age rather than a blank or a zero.
 *
 * The provider updates once a day, so refetching more often buys nothing.
 */
const SETTING_KEY = 'fx.usd_idr';
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface FxRate {
  rate: number;
  fetchedAt: Date;
  /** True when the live fetch failed and this is the last known rate. */
  stale: boolean;
}

async function readCached(): Promise<{ rate: number; fetchedAt: Date } | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value) as { rate: number; fetchedAt: string };
    if (!Number.isFinite(parsed.rate) || parsed.rate <= 0) return null;
    return { rate: parsed.rate, fetchedAt: new Date(parsed.fetchedAt) };
  } catch {
    return null;
  }
}

async function writeCached(rate: number, fetchedAt: Date): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value: JSON.stringify({ rate, fetchedAt: fetchedAt.toISOString() }) },
    create: {
      key: SETTING_KEY,
      group: 'fx',
      label: 'USD to IDR',
      valueType: 'json',
      value: JSON.stringify({ rate, fetchedAt: fetchedAt.toISOString() }),
    },
  });
}

export async function usdToIdr(): Promise<FxRate | null> {
  const cached = await readCached();
  if (cached && Date.now() - cached.fetchedAt.getTime() < MAX_AGE_MS) {
    return { ...cached, stale: false };
  }

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as { rates?: Record<string, number> };
    const rate = body.rates?.IDR;
    if (!rate || !Number.isFinite(rate)) throw new Error('no IDR rate');
    const now = new Date();
    await writeCached(rate, now);
    return { rate, fetchedAt: now, stale: false };
  } catch {
    // Never let a third party's outage empty the headline figure.
    return cached ? { ...cached, stale: true } : null;
  }
}

export function formatIdr(n: number): string {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}
