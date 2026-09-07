import { notFound } from 'next/navigation';
import { Space } from 'antd';
import '@/engine.server';
import { requireUser } from '@/lib/require-user';
import { loadAccount } from '@/lib/account-page';
import { goldOverview } from '@/lib/gold/report';
import { PageHeading } from '@/components/PageHeading';
import { GoldTabs } from '@/components/GoldTabs';
import { GoldReport } from '@/components/GoldReport';

export const dynamic = 'force-dynamic';

export default async function GoldReportPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const { accountId, account } = await loadAccount(id);
  if (!account) notFound();

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <PageHeading title={`${account.name} — Report`} />
      <GoldTabs accountId={id} />
      <GoldReport data={await goldOverview(accountId)} />
    </Space>
  );
}
