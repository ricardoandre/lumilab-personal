import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';
import { importStatement } from '../src/lib/gotrade/import-statement.ts';

const DIR = process.argv[2];
const ACCOUNT = BigInt(process.argv[3] ?? '1');
if (!DIR) { console.error('usage: node scripts/import-folder.mjs <dir> [accountId]'); process.exit(1); }

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (e.name.toLowerCase().endsWith('.pdf')) files.push(p);
  }
})(DIR);
files.sort();

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.APP_DB_URL) });
const { PDFParse } = await import('pdf-parse');

let ok = 0, dup = 0, failed = 0, tx = 0, hold = 0;
for (const f of files) {
  const buffer = fs.readFileSync(f);
  const p = new PDFParse({ data: new Uint8Array(buffer) });
  let text = ''; try { text = (await p.getText()).text; } finally { await p.destroy(); }

  const r = await importStatement(prisma, { accountId: ACCOUNT, fileName: path.basename(f), buffer, text });
  tx += r.rowsInserted; hold += r.holdings;
  if (r.status === 'ok') ok++; else if (r.status === 'duplicate') dup++; else failed++;
  const tag = r.status === 'ok' ? 'ok  ' : r.status === 'duplicate' ? 'DUP ' : 'FAIL';
  console.log(`  ${tag} ${path.relative(DIR, f).padEnd(24)} ${String(r.periodLabel ?? '').padEnd(18)} +${r.rowsInserted} tx  ${r.holdings} hold${r.error ? '  ' + r.error : ''}`);
}
console.log(`\n  imported ${ok}, duplicates ${dup}, failed ${failed}  |  ${tx} transactions, ${hold} holdings`);
await prisma.$disconnect();
