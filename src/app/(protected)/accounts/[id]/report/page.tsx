import { notFound } from 'next/navigation';
import { Typography, Space } from 'antd';
import '@/engine.server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/require-user';
import { stockReport } from '@/lib/gotrade/report';
import { ReportTabs } from '@/components/ReportTabs';
import { StocksReport } from '@/components/StocksReport';
import { ReportHeading } from '@/components/ReportHeading';

export const dynamic = 'force-dynamic';

export default async function StocksPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  let accountId: bigint;
  try { accountId = BigInt(id); } catch { notFound(); }

  const account = await prisma.account.findUnique({ where: { id: accountId! } });
  if (!account) notFound();

  const stocks = await stockReport(prisma, accountId!);

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <ReportHeading name={account.name} />
      <ReportTabs accountId={id} />
      <StocksReport stocks={stocks} />
    </Space>
  );
}
