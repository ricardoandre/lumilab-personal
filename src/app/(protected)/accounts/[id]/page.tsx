import { notFound } from 'next/navigation';
import '@/engine.server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/require-user';
import { monthlySeries, benchmarkMonthly, yearlyVsBenchmark, overviewFrom, stockReport } from '@/lib/gotrade/report';
import { AccountOverview } from '@/components/AccountOverview';

export const dynamic = 'force-dynamic';

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  let accountId: bigint;
  try { accountId = BigInt(id); } catch { notFound(); }

  const a = await prisma.account.findUnique({ where: { id: accountId! }, include: { provider: true } });
  if (!a) notFound();

  const [months, bench, stocks, newest] = await Promise.all([
    monthlySeries(prisma, accountId!),
    benchmarkMonthly(prisma, accountId!),
    stockReport(prisma, accountId!),
    prisma.statementImport.findFirst({
      where: { accountId: accountId!, status: 'ok' },
      orderBy: { periodEnd: 'desc' },
      select: { periodEnd: true },
    }),
  ]);

  // How far behind the figures are. Quiet when current, a warning when not:
  // a four-month-old number looks exactly like a fresh one otherwise.
  const asAt = newest?.periodEnd
    ? (() => {
        const end = newest.periodEnd!;
        const now = new Date();
        const monthsBehind =
          (now.getUTCFullYear() - end.getUTCFullYear()) * 12 + (now.getUTCMonth() - end.getUTCMonth());
        return {
          period: end.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
          monthsBehind: Math.max(0, monthsBehind),
        };
      })()
    : null;

  return (
    <AccountOverview
      accountId={id}
      accountName={a.name}
      provider={a.provider.label}
      currency={a.currency}
      accountNo={a.externalAccountNo}
      overview={overviewFrom(months, bench)}
      years={yearlyVsBenchmark(months, bench)}
      months={months}
      stocks={stocks}
      asAt={asAt}
    />
  );
}
