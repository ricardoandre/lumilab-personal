import '@/engine.server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/require-user';
import { usdToIdr } from '@/lib/fx';
import { goldPrice } from '@/lib/gold';
import { goldOverview, type GoldOverview } from '@/lib/gold/report';
import {
  monthlySeries, benchmarkMonthly, overviewFrom, combinePortfolios, combinedIrr,
  accountIrr, project, contributionPace, stockReport,
} from '@/lib/gotrade/report';
import { HomeDashboard, type AccountBreakdown, type YearBreakdown } from '@/components/HomeDashboard';

export const dynamic = 'force-dynamic';

const r2 = (n: number) => Math.round(n * 100) / 100;

export default async function DashboardPage() {
  await requireUser();

  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  const fx = await usdToIdr();
  const rate = fx?.rate ?? null;
  const gp = await goldPrice();

  // Statement accounts and gold are different shapes — one has a monthly history
  // to chain, the other has purchases and a live price. They meet in RUPIAH,
  // which both can express honestly.
  const statement = accounts.filter((a) => a.kind !== 'COMMODITY');
  const commodity = accounts.filter((a) => a.kind === 'COMMODITY');

  const per = [];
  for (const a of statement) {
    const [months, bench, stocks] = await Promise.all([
      monthlySeries(prisma, a.id), benchmarkMonthly(prisma, a.id), stockReport(prisma, a.id),
    ]);
    const overview = overviewFrom(months, bench, stocks);
    const irr = overview && months.length
      ? await accountIrr(prisma, a.id, overview.latestValue, new Date(months[months.length - 1].periodEnd))
      : null;
    per.push({ account: a, months, overview, irr });
  }

  const gold: { account: (typeof accounts)[number]; data: GoldOverview }[] = [];
  for (const a of commodity) gold.push({ account: a, data: await goldOverview(a.id) });

  const combined = combinePortfolios(per.map((p) => ({ name: p.account.name, months: p.months })));
  const withData = per.filter((p) => p.overview);

  const asOf = combined.lastPeriod ? new Date(`${combined.lastPeriod}-01T00:00:00Z`) : new Date();
  const investIrr = withData.length
    ? await combinedIrr(prisma, withData.map((p) => p.account.id), combined.totalValue, asOf)
    : null;

  /**
   * Convert to rupiah ONLY when the account is not already in rupiah.
   *
   * Converting unconditionally multiplied IPOT's Rp 2.33 billion by the dollar
   * rate and reported a net worth of Rp 41 TRILLION. The currency has to be
   * asked for per account; assuming every account is USD held only while every
   * account happened to be.
   */
  const inIdr = (amount: number, currency: string) =>
    currency === 'IDR' ? r2(amount) : rate === null ? 0 : r2(amount * rate);
  const toIdr = (usd: number) => (rate === null ? 0 : r2(usd * rate));

  const perAccountTotals = withData.reduce(
    (acc, p) => ({
      value: acc.value + inIdr(p.overview!.latestValue, p.account.currency),
      invested: acc.invested + inIdr(p.overview!.contributions, p.account.currency),
      gain: acc.gain + inIdr(p.overview!.gain, p.account.currency),
    }),
    { value: 0, invested: 0, gain: 0 },
  );

  const goldIdr = gold.reduce((a, g) => a + g.data.valueNow, 0);
  const goldInvested = gold.reduce((a, g) => a + g.data.invested, 0);
  const goldGain = gold.reduce((a, g) => a + g.data.gain, 0);

  // Summed per account rather than from the combined series, which is in mixed
  // units and cannot be converted with one rate.
  const totalIdr = r2(perAccountTotals.value + goldIdr);
  const investedIdr = r2(perAccountTotals.invested + goldInvested);
  const gainIdr = r2(perAccountTotals.gain + goldGain);

  // Per-account rows, everything in rupiah so the drawers compare like with like.
  const perAccount: AccountBreakdown[] = [
    ...withData.map((p) => ({
      id: String(p.account.id),
      name: p.account.name,
      currency: p.account.currency,
      valueIdr: inIdr(p.overview!.latestValue, p.account.currency),
      valueNative: p.overview!.latestValue,
      investedIdr: inIdr(p.overview!.contributions, p.account.currency),
      gainIdr: inIdr(p.overview!.gain, p.account.currency),
      simpleReturn: p.overview!.simpleReturn,
      annualised: p.overview!.annualised,
      irr: p.irr,
      asOf: monthLabel(p.months[p.months.length - 1].period),
      href: `/accounts/${p.account.id}`,
    })),
    ...gold.map((g) => ({
      id: String(g.account.id),
      name: g.account.name,
      currency: g.account.currency,
      valueIdr: g.data.valueNow,
      valueNative: g.data.valueNow,
      investedIdr: g.data.invested,
      gainIdr: g.data.gain,
      simpleReturn: g.data.simpleReturn,
      annualised: g.data.annualised,
      irr: g.data.irr,
      asOf: gp ? 'live price' : 'no price',
      href: `/accounts/${g.account.id}/gold`,
    })),
  ].sort((a, b) => b.valueIdr - a.valueIdr);

  // Year rows, each carrying its own per-account split.
  const goldByYear = new Map<string, { invested: number; gain: number }>();
  for (const g of gold) {
    for (const lot of g.data.lots) {
      const y = lot.date.slice(0, 4);
      const cur = goldByYear.get(y) ?? { invested: 0, gain: 0 };
      goldByYear.set(y, { invested: cur.invested + lot.total, gain: cur.gain + lot.gain });
    }
  }
  const years: YearBreakdown[] = combined.years.map((y) => {
    const goldY = goldByYear.get(y.year) ?? { invested: 0, gain: 0 };
    return {
      year: y.year,
      startValueIdr: toIdr(y.startValue),
      endValueIdr: toIdr(y.endValue),
      investedIdr: r2(toIdr(y.contributions) + goldY.invested),
      gainIdr: toIdr(y.gain),
      returnPct: y.returnPct,
      byAccount: [
        ...withData.map((p) => {
          const own = p.months.filter((m) => m.period.startsWith(y.year));
          return {
            name: p.account.name,
            investedIdr: inIdr(own.reduce((a, m) => a + m.contributions, 0), p.account.currency),
            gainIdr: inIdr(own.reduce((a, m) => a + m.gain, 0), p.account.currency),
          };
        }),
        ...gold.map((g) => ({
          name: g.account.name,
          investedIdr: goldByYear.get(y.year)?.invested ?? 0,
          gainIdr: goldByYear.get(y.year)?.gain ?? 0,
        })),
      ].filter((r) => r.investedIdr !== 0 || r.gainIdr !== 0),
    };
  });

  // PROJECTION now includes gold, projected at its OWN rate. Growing everything
  // at the investments' rate would have quietly assumed gold behaves like SPY.
  // Contribution pace summed per account, for the same mixed-unit reason.
  const investPace = withData.reduce(
    (a, p) => a + inIdr(contributionPace(p.months), p.account.currency), 0);
  const goldPace = gold.length && gold[0].data.firstPurchase
    ? goldInvested / Math.max(1, (Date.now() - new Date(gold[0].data.firstPurchase).getTime()) / (365.25 * 24 * 3600 * 1000))
    : 0;
  const goldRate = gold.length ? gold[0].data.irr ?? gold[0].data.annualised : null;

  const projections = [5, 10].map((yrs) => {
    const invStop = project(perAccountTotals.value, combined.annualised, 0)
      .find((p) => p.years === yrs);
    const invKeep = project(perAccountTotals.value, combined.annualised, investPace)
      .find((p) => p.years === yrs);
    const goldStop = project(goldIdr, goldRate, 0).find((p) => p.years === yrs);
    const goldKeep = project(goldIdr, goldRate, goldPace).find((p) => p.years === yrs);
    return {
      years: yrs,
      stop: r2((invStop?.value ?? 0) + (goldStop?.value ?? 0)),
      keep: r2((invKeep ? invKeep.value + invKeep.contributed : 0) + (goldKeep ? goldKeep.value + goldKeep.contributed : 0)),
    };
  });

  return (
    <HomeDashboard
      totalIdr={rate === null ? null : totalIdr}
      investmentsIdr={perAccountTotals.value}
      investmentsUsd={combined.totalValue}
      goldIdr={goldIdr}
      investedIdr={rate === null ? null : investedIdr}
      gainIdr={rate === null ? null : gainIdr}
      fxRate={rate}
      fxFetchedAt={fx ? fx.fetchedAt.toISOString().slice(0, 10) : null}
      fxStale={fx?.stale ?? false}
      goldPerGram={gp?.idrPerGram ?? null}
      goldStale={gp?.stale ?? false}
      simpleReturn={investedIdr > 0 ? r2(gainIdr / investedIdr) : null}
      annualised={combined.annualised}
      irr={investIrr}
      years={years}
      accounts={perAccount}
      projections={projections}
      projectionRates={{ investments: combined.annualised, gold: goldRate }}
      asOfLabel={combined.lastPeriod ? monthLabel(combined.lastPeriod) : '—'}
      coverage={perAccount.map((a) => ({ name: a.name, period: a.asOf }))}
    />
  );
}

function monthLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
