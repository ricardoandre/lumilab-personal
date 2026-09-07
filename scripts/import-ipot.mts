import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';
import { importIpotFile } from '/home/claudeuser/lumilab-personal/src/lib/ipot/import.ts';

const DIR = process.argv[2];
const ACCOUNT = BigInt(process.argv[3] ?? '4');
const files: string[] = [];
(function walk(d: string) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.toLowerCase().endsWith('.pdf') && !e.name.includes('STOCK_MOVEMENT')) files.push(p);
  }
})(DIR);
files.sort();

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.APP_DB_URL) });
let ok = 0, dup = 0, failed = 0, tx = 0, hold = 0;
for (const f of files) {
  const r = await importIpotFile(prisma, { accountId: ACCOUNT, fileName: path.basename(f), buffer: fs.readFileSync(f) });
  tx += r.rowsInserted; hold += r.holdings;
  if (r.status === 'ok') ok++; else if (r.status === 'duplicate') dup++; else failed++;
  const tag = r.status === 'ok' ? (r.kind === 'portfolio' ? 'PORT' : 'ok  ') : r.status === 'duplicate' ? 'DUP ' : 'FAIL';
  console.log(`  ${tag} ${String(r.period ?? '').padEnd(9)} ${path.basename(f).slice(0, 42).padEnd(44)} +${r.rowsInserted} tx  ${r.holdings} hold${r.error ? '  ' + r.error : ''}`);
}
console.log(`\n  ${ok} imported, ${dup} duplicates, ${failed} failed  |  ${tx} transactions, ${hold} holdings`);
await prisma.$disconnect();
