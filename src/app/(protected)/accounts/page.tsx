import '@/engine.server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/require-user';
import { AccountsTable, type AccountRow } from '@/components/AccountsTable';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  await requireUser();

  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { provider: true, _count: { select: { transactions: true, imports: true } } },
  });

  const rows: AccountRow[] = accounts.map((a) => ({
    key: String(a.id),
    name: a.name,
    provider: a.provider.label,
    color: a.provider.color,
    kind: a.kind,
    currency: a.currency,
    accountNo: a.externalAccountNo,
    imports: a._count.imports,
    transactions: a._count.transactions,
  }));

  return <AccountsTable rows={rows} />;
}
