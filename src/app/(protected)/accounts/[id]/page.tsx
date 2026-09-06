import { notFound } from 'next/navigation';
import '@/engine.server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/require-user';
import { monthlySeries, benchmarkMonthly, yearlyVsBenchmark, overviewFrom } from '@/lib/gotrade/report';
import { AccountOverview } from '@/components/AccountOverview';

export const dynamic = 'force-dynamic';

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  let accountId: bigint;
  try { accountId = BigInt(id); } catch { notFound(); }

  const a = await prisma.account.findUnique({ where: { id: accountId! }, include: { provider: true } });
  if (!a) notFound();

  const months = await monthlySeries(prisma, accountId!);
  const bench = await benchmarkMonthly(prisma, accountId!);

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
    />
  );
}
