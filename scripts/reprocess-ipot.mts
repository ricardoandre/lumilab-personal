import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';
import { importIpotFile } from '/home/claudeuser/lumilab-personal/src/lib/ipot/import.ts';
import { read } from '/home/claudeuser/lumilab-personal/src/lib/storage.ts';

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.APP_DB_URL) });
const accountId = BigInt(process.argv[2] ?? '4');

const failed = await prisma.statementImport.findMany({
  where: { accountId, status: 'failed' },
  orderBy: { fileName: 'asc' },
});
console.log(`  ${failed.length} failed import(s)`);

let fixed = 0, still = 0, lost = 0;
for (const imp of failed) {
  if (!imp.storageKey) { console.log(`  NO FILE  ${imp.fileName}`); lost++; continue; }
  let buffer: Buffer;
  try { buffer = await read(imp.storageKey); }
  catch { console.log(`  MISSING  ${imp.fileName}`); lost++; continue; }

  // Remove the failed record so its checksum does not read as a duplicate of itself.
  await prisma.statementImport.delete({ where: { id: imp.id } });
  const r = await importIpotFile(prisma, { accountId, fileName: imp.fileName, buffer });
  if (r.status === 'ok') { fixed++; console.log(`  FIXED    ${String(r.period).padEnd(9)} ${imp.fileName.slice(0, 46)}  +${r.rowsInserted} tx  ${r.holdings} hold`); }
  else { still++; console.log(`  STILL    ${imp.fileName.slice(0, 46)}: ${r.error}`); }
}
console.log(`\n  fixed ${fixed}, still failing ${still}, no file ${lost}`);
await prisma.$disconnect();
