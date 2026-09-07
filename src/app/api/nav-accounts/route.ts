import { NextResponse } from 'next/server';
import '@/engine.server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// The sidebar's account entries. Andre: "the menu on the left will be list of
// all finance and investment available" — so they come from the Account table,
// and adding an account adds a menu entry with no code change.
//
// Served as an API rather than baked into NAV_GROUPS because the nav is
// configured on the CLIENT (AppSider renders in the browser) and the client has
// no database.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, kind: true },
  });
  return NextResponse.json({
    accounts: accounts.map((a) => ({ id: String(a.id), name: a.name, kind: a.kind })),
  });
}
