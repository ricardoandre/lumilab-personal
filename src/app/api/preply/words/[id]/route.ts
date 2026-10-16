import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

async function target(params: Promise<{ id: string }>) {
  const session = await auth();
  if (!session?.user) return null;
  const { id } = await params;
  return /^\d+$/.test(id) ? BigInt(id) : null;
}

/** Correct a word: characters, pinyin or meaning. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = await target(params);
  if (id == null) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const hanzi = String(body.hanzi ?? '').trim();
  const pinyin = String(body.pinyin ?? '').trim();
  const meaning = String(body.meaning ?? '').trim() || null;
  if (!hanzi || !pinyin) return NextResponse.json({ error: 'Characters and pinyin are both needed.' }, { status: 400 });
  try {
    await prisma.preplyWord.update({ where: { id }, data: { hanzi, pinyin, meaning } });
  } catch {
    return NextResponse.json({ error: 'That word is already in this lesson.' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = await target(params);
  if (id == null) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await prisma.preplyWord.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
