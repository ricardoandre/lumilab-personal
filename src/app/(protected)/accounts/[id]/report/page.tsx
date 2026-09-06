import { notFound } from 'next/navigation';
import '@/engine.server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/require-user';
import { monthlySeries, yearlyFromMonths, stockReport } from '@/lib/gotrade/report';
import { GotradeReport } from '@/components/GotradeReport';

export const dynamic = 'force-dynamic';

export default async function AccountReportPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  let accountId: bigint;
  try { accountId = BigInt(id); } catch { notFound(); }

  const account = await prisma.account.findUnique({ where: { id: accountId! } });
  if (!account) notFound();

  const months = await monthlySeries(prisma, accountId!);
  const years = yearlyFromMonths(months);
  const stocks = await stockReport(prisma, accountId!);

  return <GotradeReport accountName={account.name} months={months} years={years} stocks={stocks} />;
}
