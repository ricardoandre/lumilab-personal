import '@/engine.server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/require-user';
import { DashboardView } from '@/components/DashboardView';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  await requireUser();
  const [accounts, imports, txs] = await Promise.all([
    prisma.account.count({ where: { isActive: true } }),
    prisma.statementImport.count(),
    prisma.transaction.count(),
  ]);
  return <DashboardView accounts={accounts} imports={imports} txs={txs} />;
}
