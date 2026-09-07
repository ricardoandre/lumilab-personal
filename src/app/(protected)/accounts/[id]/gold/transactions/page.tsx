import { notFound } from 'next/navigation';
import { Space } from 'antd';
import '@/engine.server';
import { requireUser } from '@/lib/require-user';
import { loadAccount } from '@/lib/account-page';
import { PageHeading } from '@/components/PageHeading';
import { GoldTabs } from '@/components/GoldTabs';
import { GoldPurchasesList } from '@/components/GoldPurchasesList';

export const dynamic = 'force-dynamic';

export default async function GoldTransactionsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const { account } = await loadAccount(id);
  if (!account) notFound();

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <PageHeading title={account.name} />
      <GoldTabs accountId={id} />
      <GoldPurchasesList />
    </Space>
  );
}
