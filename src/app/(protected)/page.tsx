import '@/engine.server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/require-user';
import { usdToIdr } from '@/lib/fx';
import {
  monthlySeries, benchmarkMonthly, overviewFrom, combinePortfolios, combinedIrr,
  project, contributionPace, stockReport,
} from '@/lib/gotrade/report';
import { HomeDashboard, type AccountSlice } from '@/components/HomeDashboard';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  await requireUser();

  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  const per = [];
  for (const a of accounts) {
    const [months, bench, stocks] = await Promise.all([
      monthlySeries(prisma, a.id),
      benchmarkMonthly(prisma, a.id),
      stockReport(prisma, a.id),
    ]);
    per.push({ account: a, months, overview: overviewFrom(months, bench, stocks) });
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
  const pace = contributionPace(combined.months);
  const stop = project(combined.totalValue, combined.annualised, 0);
  const keep = project(combined.totalValue, combined.annualised, pace);

  const slices: AccountSlice[] = withData.map((p) => ({
    id: String(p.account.id),
    name: p.account.name,
    value: p.overview!.latestValue,
    currency: p.account.currency,
    annualised: p.overview!.annualised,
    asOf: monthLabel(p.months[p.months.length - 1].period),
  }));

  return (
    <HomeDashboard
      totalUsd={combined.totalValue}
      totalIdr={fx ? combined.totalValue * fx.rate : null}
      fxRate={fx?.rate ?? null}
      fxFetchedAt={fx ? fx.fetchedAt.toISOString().slice(0, 10) : null}
      fxStale={fx?.stale ?? false}
      contributions={combined.totalContributions}
      gain={combined.totalGain}
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
