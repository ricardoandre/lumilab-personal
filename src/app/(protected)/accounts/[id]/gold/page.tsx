import { notFound } from 'next/navigation';
import '@/engine.server';
import { requireUser } from '@/lib/require-user';
import { loadAccount } from '@/lib/account-page';
import { goldOverview } from '@/lib/gold/report';
import { GoldDashboard } from '@/components/GoldDashboard';

export const dynamic = 'force-dynamic';

export default async function GoldPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const { accountId, account } = await loadAccount(id);
  if (!account) notFound();

  return <GoldDashboard accountId={id} data={await goldOverview(accountId)} />;
}
