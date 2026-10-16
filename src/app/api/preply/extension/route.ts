import fs from 'node:fs/promises';
import path from 'node:path';
import { auth } from '@/auth';
import { zip } from '@/lib/preply/zip';

/**
 * The Chrome extension as a zip, with this server's address and the sync token
 * written into config.js — so installing it needs no setup at all. Signed-in
 * only: the token in it can add words to this account.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response('Unauthorized', { status: 401 });
  const dir = path.join(process.cwd(), 'extension', 'preply-sync');
  const names = await fs.readdir(dir);
  const files = await Promise.all(names.map(async (n) => ({ name: `preply-sync/${n}`, data: await fs.readFile(path.join(dir, n)) })));
  const base = process.env.NEXTAUTH_URL || 'https://personal.lumilabcreative.com';
  files.push({
    name: 'preply-sync/config.js',
    data: Buffer.from(`const SYNC_URL = ${JSON.stringify(new URL('/api/preply/sync', base).toString())};\nconst SYNC_TOKEN = ${JSON.stringify(process.env.PREPLY_SYNC_TOKEN ?? '')};\n`),
  });
  return new Response(new Uint8Array(zip(files)), {
    headers: { 'content-type': 'application/zip', 'content-disposition': 'attachment; filename="preply-sync.zip"' },
  });
}
