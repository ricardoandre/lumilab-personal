import { notFound } from 'next/navigation';
import '@/engine.server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/require-user';
import { stockReport } from '@/lib/gotrade/report';
import { loadAccount } from '@/lib/account-page';
import { reportHealth } from '@/lib/report-page';
import { ReportShell } from '@/components/ReportShell';
import { StocksReport } from '@/components/StocksReport';

export const dynamic = 'force-dynamic';

export default async function StocksPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const { accountId, account } = await loadAccount(id);
  if (!account) notFound();

  const [stocks, health] = await Promise.all([stockReport(prisma, accountId), reportHealth(accountId)]);
  return (
    <ReportShell accountId={id} accountName={account.name} {...health}>
      <StocksReport stocks={stocks} />
    </ReportShell>
  );
}
