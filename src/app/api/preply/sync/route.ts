import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { importChat } from '@/lib/preply/import';
import { put } from '@/lib/storage';

/**
 * Where the Chrome extension posts the open Preply conversation. No session
 * cookie reaches here from an extension, so it carries PREPLY_SYNC_TOKEN instead
 * (baked into the extension download); auth.config lets this one path through.
 *
 * The raw text of every sync is kept, last one only, so a parser miss on a real
 * page can be read and fixed rather than guessed at.
 */
export async function POST(req: Request) {
  const want = process.env.PREPLY_SYNC_TOKEN ?? '';
  const got = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!want || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const text = String(body.text ?? '');
  if (!text.trim()) return NextResponse.json({ error: 'No text' }, { status: 400 });
  await put('preply/last-sync.txt', Buffer.from(`${new Date().toISOString()} ${body.url ?? ''}\n\n${text}`));
  return NextResponse.json(await importChat(text));
}
