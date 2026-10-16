import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { importChat, previewChat } from '@/lib/preply/import';

/** The paste box: `{ text, save: false }` previews, `{ text, save: true }` saves. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const text = String(body.text ?? '');
  if (!text.trim()) return NextResponse.json({ error: 'Paste the chat first.' }, { status: 400 });
  if (!body.save) return NextResponse.json({ lessons: previewChat(text) });
  return NextResponse.json(await importChat(text));
}
