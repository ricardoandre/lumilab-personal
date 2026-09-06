import { notFound } from 'next/navigation';
import '@/engine.server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/require-user';
import { monthlySeries, benchmarkMonthly, yearlyVsBenchmark, overviewFrom, stockReport, accountIrr, yearlyIrr } from '@/lib/gotrade/report';
import { loadAccount } from '@/lib/account-page';
import { reportHealth } from '@/lib/report-page';
import { ReportShell } from '@/components/ReportShell';
import { AccountOverview } from '@/components/AccountOverview';

export const dynamic = 'force-dynamic';

export default async function OverviewReportPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const { accountId, account } = await loadAccount(id);
  if (!account) notFound();

  const [months, bench, stocks, health] = await Promise.all([
    monthlySeries(prisma, accountId),
    benchmarkMonthly(prisma, accountId),
    stockReport(prisma, accountId),
    reportHealth(accountId),
  ]);

  const overview = overviewFrom(months, bench, stocks);
  const irrYears = await yearlyIrr(prisma, accountId, months);
  const irr = overview && months.length
    ? await accountIrr(prisma, accountId, overview.latestValue, new Date(months[months.length - 1].periodEnd))
    : null;

  return (
    <ReportShell accountId={id} accountName={account.name} {...health}>
      <AccountOverview
        overview={overview}
        years={yearlyVsBenchmark(months, bench)}
        months={months}
        stocks={stocks}
        irr={irr}
        irrYears={irrYears}
      />
    </ReportShell>
  );
}
