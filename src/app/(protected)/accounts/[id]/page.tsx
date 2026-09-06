import { notFound } from 'next/navigation';
import '@/engine.server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/require-user';
import { AccountDetailView, type AccountDetail } from '@/components/AccountDetailView';

export const dynamic = 'force-dynamic';

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  // A bad id must 404, not throw: BigInt('abc') is a TypeError, which would be a
  // 500 on a URL anyone can mistype.
  let accountId: bigint;
  try { accountId = BigInt(id); } catch { notFound(); }

  const a = await prisma.account.findUnique({
    where: { id: accountId! },
    include: { provider: true, _count: { select: { transactions: true, imports: true } } },
  });
  if (!a) notFound();

  const account: AccountDetail = {
    name: a.name, provider: a.provider.label, color: a.provider.color,
    kind: a.kind, currency: a.currency, accountNo: a.externalAccountNo,
    imports: a._count.imports, transactions: a._count.transactions,
  };
  return <AccountDetailView account={account} />;
}
