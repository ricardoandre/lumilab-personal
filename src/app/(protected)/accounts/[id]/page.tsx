import { notFound } from 'next/navigation';
import '@/engine.server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/require-user';
import {
  monthlySeries, benchmarkMonthly, yearlyVsBenchmark, overviewFrom, stockReport,
  missingMonths, failedImports,
} from '@/lib/gotrade/report';
import { AccountDashboard } from '@/components/AccountDashboard';
import { loadAccount } from '@/lib/account-page';

export const dynamic = 'force-dynamic';

export default async function AccountDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const { accountId, account } = await loadAccount(id);
  if (!account) notFound();

  const [months, bench, stocks, missing, failed] = await Promise.all([
    monthlySeries(prisma, accountId),
    benchmarkMonthly(prisma, accountId),
    stockReport(prisma, accountId),
    missingMonths(prisma, accountId),
    failedImports(prisma, accountId),
  ]);

  const years = yearlyVsBenchmark(months, bench);
  // "This year" is the newest year present in the data, not the wall-clock year:
  // the statements can be months behind, and an empty box would be the result.
  const latestYear = years.length ? years[years.length - 1] : null;
  const thisYearMonths = latestYear ? months.filter((m) => m.period.startsWith(latestYear.year)) : [];

  const newest = months.length ? months[months.length - 1] : null;
  const asAt = newest
    ? (() => {
        const [y, m] = newest.period.split('-').map(Number);
        const now = new Date();
        return {
          period: new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
          monthsBehind: Math.max(0, (now.getUTCFullYear() - y) * 12 + (now.getUTCMonth() - (m - 1))),
        };
      })()
    : null;

  return (
    <AccountDashboard
      accountId={id}
      accountName={account.name}
      provider={account.provider.label}
      currency={account.currency}
      accountNo={account.externalAccountNo}
      overview={overviewFrom(months, bench)}
      stocks={stocks}
      months={months}
      thisYear={latestYear}
      thisYearMonths={thisYearMonths.length >= 2 ? thisYearMonths : months.slice(-12)}
      asAt={asAt}
      missing={missing}
      failed={failed}
    />
  );
}
