import { notFound } from 'next/navigation';
import '@/engine.server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/require-user';
import { loadAccount } from '@/lib/account-page';
import { reportHealth } from '@/lib/report-page';
import { ReportShell } from '@/components/ReportShell';
import { TransactionsReport, type TxRow } from '@/components/TransactionsReport';

export const dynamic = 'force-dynamic';

export default async function TransactionsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const { accountId, account } = await loadAccount(id);
  if (!account) notFound();

  const [txs, health] = await Promise.all([
    prisma.transaction.findMany({
      where: { accountId },
      orderBy: [{ tradeDate: 'desc' }, { id: 'desc' }],
      include: { security: true },
    }),
    reportHealth(accountId),
  ]);

  const rows: TxRow[] = txs.map((t) => ({
    key: String(t.id),
    date: t.tradeDate.toISOString().slice(0, 10),
    type: t.type,
    symbol: t.security?.symbol ?? null,
    quantity: t.quantity === null ? null : Number(t.quantity),
    price: t.price === null ? null : Number(t.price),
    amount: Number(t.netAmount),
    description: t.description,
  }));

  return (
    <ReportShell accountId={id} accountName={account.name} {...health}>
      <TransactionsReport rows={rows} />
    </ReportShell>
  );
}
