import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import '@/engine.server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { currentPassword, newPassword } = await req.json().catch(() => ({}));
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Both current and new password are required.' }, { status: 400 });
  }
  if (String(newPassword).length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: BigInt(session.user.id) } });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // The CURRENT password is required even though the session already proves who
  // this is: a session can be left open on a shared machine, and this is the one
  // endpoint that would let someone take the account over permanently.
  if (!(await bcrypt.compare(String(currentPassword), user.passwordHash))) {
    return NextResponse.json({ error: 'Current password is wrong.' }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(String(newPassword), 10) },
  });
  return NextResponse.json({ ok: true });
}
