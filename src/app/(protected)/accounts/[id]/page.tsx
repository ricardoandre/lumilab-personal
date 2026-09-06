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

  const [months, bench, stocks, newest, total] = await Promise.all([
    monthlySeries(prisma, accountId!),
    benchmarkMonthly(prisma, accountId!),
    stockReport(prisma, accountId!),
    prisma.statementImport.findFirst({
      where: { accountId: accountId!, status: 'ok' },
      orderBy: { periodEnd: 'desc' },
      select: { periodEnd: true, fileName: true, createdAt: true },
    }),
    prisma.statementImport.count({ where: { accountId: accountId!, status: 'ok' } }),
  ]);

  // Which statement the figures are as at — so a stale upload is visible rather
  // than being mistaken for today's position.
  const latestStatement = newest?.periodEnd
    ? {
        period: newest.periodEnd.toISOString().slice(0, 7),
        fileName: newest.fileName,
        importedAt: newest.createdAt.toISOString().slice(0, 10),
        total,
      }
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
      latestStatement={latestStatement}
    />
  );
}
