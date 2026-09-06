import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Where uploaded source documents live.
 *
 * OUTSIDE the repo and outside .next, so a deploy or a build never touches them.
 * Local disk for now; the interface is deliberately tiny (put/read/remove by
 * key) so moving to S3 later is one file, not a hunt through call sites.
 */
const ROOT = process.env.STORAGE_ROOT || '/home/claudeuser/lumilab-storage';

export function statementKey(accountId: bigint | string, checksum: string): string {
  return path.posix.join('statements', String(accountId), `${checksum}.pdf`);
}

export async function put(key: string, data: Buffer): Promise<string> {
  const target = path.join(ROOT, key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, data);
  return key;
}

export async function read(key: string): Promise<Buffer> {
  return fs.readFile(path.join(ROOT, key));
}

export async function exists(key: string): Promise<boolean> {
  try { await fs.access(path.join(ROOT, key)); return true; } catch { return false; }
}
