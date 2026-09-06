import { notFound } from 'next/navigation';
import { Space } from 'antd';
import '@/engine.server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/require-user';
import { ReportTabs } from '@/components/ReportTabs';
import { TransactionsReport, type TxRow } from '@/components/TransactionsReport';
import { ReportHeading } from '@/components/ReportHeading';

export const dynamic = 'force-dynamic';

export default async function TransactionsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  let accountId: bigint;
  try { accountId = BigInt(id); } catch { notFound(); }

  const account = await prisma.account.findUnique({ where: { id: accountId! } });
  if (!account) notFound();

  const txs = await prisma.transaction.findMany({
    where: { accountId: accountId! },
    orderBy: [{ tradeDate: 'desc' }, { id: 'desc' }],
    include: { security: true },
  });

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
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <ReportHeading name={account.name} />
      <ReportTabs accountId={id} />
      <TransactionsReport rows={rows} />
    </Space>
  );
}
