/**
 * Re-run stored statements whose import failed.
 *
 * The whole reason files are kept: a parser fix should be applied to what
 * already failed, without asking anyone to find and upload it again.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';
import { importStatement } from '../src/lib/gotrade/import-statement.ts';
import { read } from '../src/lib/storage.ts';

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.APP_DB_URL) });
const { PDFParse } = await import('pdf-parse');

const failed = await prisma.statementImport.findMany({ where: { status: 'failed' }, include: { account: true } });
console.log(`  ${failed.length} failed import(s)`);

let fixed = 0, still = 0, lost = 0;
for (const imp of failed) {
  if (!imp.storageKey) { console.log(`  NO FILE  ${imp.fileName} — re-upload needed`); lost++; continue; }
  let buffer;
  try { buffer = await read(imp.storageKey); }
  catch { console.log(`  MISSING  ${imp.fileName} — stored file gone`); lost++; continue; }

  // Drop the failed record first: its checksum would otherwise make the retry
  // look like a duplicate of itself.
  await prisma.statementImport.delete({ where: { id: imp.id } });

  const p = new PDFParse({ data: new Uint8Array(buffer) });
  let text = ''; try { text = (await p.getText()).text; } finally { await p.destroy(); }

  const r = await importStatement(prisma, {
    accountId: imp.accountId, fileName: imp.fileName, buffer, text,
  });
  if (r.status === 'ok') { fixed++; console.log(`  FIXED    ${imp.account.name} ${imp.fileName} ${r.periodLabel} +${r.rowsInserted} tx, ${r.holdings} holdings`); }
  else { still++; console.log(`  STILL    ${imp.fileName}: ${r.error}`); }
}
console.log(`\n  fixed ${fixed}, still failing ${still}, no stored file ${lost}`);
await prisma.$disconnect();
