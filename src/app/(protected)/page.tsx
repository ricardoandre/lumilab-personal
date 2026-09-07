import '@/engine.server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/require-user';
import { usdToIdr } from '@/lib/fx';
import {
  monthlySeries, benchmarkMonthly, overviewFrom, combinePortfolios, combinedIrr,
  project, contributionPace, stockReport,
} from '@/lib/gotrade/report';
import { goldOverview } from '@/lib/gold/report';
import { HomeDashboard, type AccountSlice } from '@/components/HomeDashboard';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  await requireUser();

  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  // Statement-driven accounts and gold are different shapes: one has a monthly
  // history to chain, the other has purchases and one live price. They are
  // combined at the top by VALUE, which both can produce honestly.
  const statementAccounts = accounts.filter((a) => a.kind !== 'COMMODITY');
  const commodityAccounts = accounts.filter((a) => a.kind === 'COMMODITY');

  const per = [];
  for (const a of statementAccounts) {
    const [months, bench, stocks] = await Promise.all([
      monthlySeries(prisma, a.id),
      benchmarkMonthly(prisma, a.id),
      stockReport(prisma, a.id),
    ]);
    per.push({ account: a, months, overview: overviewFrom(months, bench, stocks) });
  }

  const gold = [];
  for (const a of commodityAccounts) {
    gold.push({ account: a, data: await goldOverview(a.id) });
  }

  const combined = combinePortfolios(per.map((p) => ({ name: p.account.name, months: p.months })));
  const withData = per.filter((p) => p.overview);

  const asOf = combined.lastPeriod
    ? new Date(`${combined.lastPeriod}-01T00:00:00Z`)
    : new Date();
  const irr = withData.length
    ? await combinedIrr(prisma, withData.map((p) => p.account.id), combined.totalValue, asOf)
    : null;

  const fx = await usdToIdr();

  // Everything is expressed in RUPIAH for the combined view: the USD accounts at
  // today's rate, gold natively. Summing dollars and rupiah as if they were the
  // same unit would be a straightforward lie.
  const goldIdr = gold.reduce((a, g) => a + g.data.valueNow, 0);
  const goldInvestedIdr = gold.reduce((a, g) => a + g.data.invested, 0);
  const goldGainIdr = gold.reduce((a, g) => a + g.data.gain, 0);
  const usdInIdr = fx ? combined.totalValue * fx.rate : null;
  const totalIdr = usdInIdr === null ? null : usdInIdr + goldIdr;
  const pace = contributionPace(combined.months);
  const stop = project(combined.totalValue, combined.annualised, 0);
  const keep = project(combined.totalValue, combined.annualised, pace);

  // Slice values are IDR so the pie and the list compare like with like.
  const slices: AccountSlice[] = [
    ...withData.map((p) => ({
      id: String(p.account.id),
      name: p.account.name,
      value: fx ? p.overview!.latestValue * fx.rate : 0,
      valueNative: p.overview!.latestValue,
      currency: p.account.currency,
      annualised: p.overview!.annualised,
      asOf: monthLabel(p.months[p.months.length - 1].period),
    })),
    ...gold.map((g) => ({
      id: String(g.account.id),
      name: g.account.name,
      value: g.data.valueNow,
      valueNative: g.data.valueNow,
      currency: g.account.currency,
      annualised: g.data.annualised,
      asOf: g.data.priceFetchedAt ? 'live price' : 'no price',
    })),
  ].sort((a, b) => b.value - a.value);

  return (
    <HomeDashboard
      totalUsd={combined.totalValue}
      totalIdr={totalIdr}
      goldIdr={goldIdr}
      goldInvestedIdr={goldInvestedIdr}
      goldGainIdr={goldGainIdr}
      fxRate={fx?.rate ?? null}
      fxFetchedAt={fx ? fx.fetchedAt.toISOString().slice(0, 10) : null}
      fxStale={fx?.stale ?? false}
      contributions={combined.totalContributions}
      contributionsIdr={fx ? combined.totalContributions * fx.rate + goldInvestedIdr : null}
      gain={combined.totalGain}
      gainIdr={fx ? combined.totalGain * fx.rate + goldGainIdr : null}
      simpleReturn={combined.simpleReturn}
      annualised={combined.annualised}
      irr={irr}
      years={combined.years}
      accounts={slices}
      projections={stop.map((s, i) => ({
        years: s.years,
        stop: s.value,
        keep: Math.round((keep[i].value + keep[i].contributed) * 100) / 100,
      }))}
      asOfLabel={combined.lastPeriod ? monthLabel(combined.lastPeriod) : '—'}
      coverage={combined.asOfByAccount.map((c) => ({ name: c.name, period: monthLabel(c.period) }))}
    />
  );
}

function monthLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
