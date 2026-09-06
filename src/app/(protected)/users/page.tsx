import '@/engine.server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/require-user';
import { UsersTable, type UserRow } from '@/components/UsersTable';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  await requireUser();
  const users = await prisma.user.findMany({ orderBy: { id: 'asc' } });
  const rows: UserRow[] = users.map((u) => ({
    key: String(u.id),
    email: u.email,
    nickname: u.nickname,
    isAdmin: u.isAdmin,
    createdAt: u.createdAt.toISOString().slice(0, 10),
  }));
  return <UsersTable rows={rows} />;
}
