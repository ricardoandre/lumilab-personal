import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.APP_DB_URL) });

// Providers live as FieldOption rows so adding a broker never needs a migration.
const providers = [
  { value: 'GOTRADE', label: 'Gotrade', color: 'blue', sortOrder: 10 },
  { value: 'BCA', label: 'BCA', color: 'cyan', sortOrder: 20 },
  { value: 'IPOT', label: 'IPOT', color: 'green', sortOrder: 30 },
];
for (const p of providers) {
  await prisma.fieldOption.upsert({
    where: { fieldKey_value: { fieldKey: 'account.provider', value: p.value } },
    update: { label: p.label, color: p.color, sortOrder: p.sortOrder },
    create: { fieldKey: 'account.provider', ...p },
  });
}
const gotrade = await prisma.fieldOption.findUniqueOrThrow({
  where: { fieldKey_value: { fieldKey: 'account.provider', value: 'GOTRADE' } },
});

const existing = await prisma.account.findFirst({
  where: { providerId: gotrade.id, externalAccountNo: '933194961' },
});
const account = existing
  ? await prisma.account.update({ where: { id: existing.id }, data: { name: 'Andre Gotrade' } })
  : await prisma.account.create({
      data: {
        name: 'Andre Gotrade',
        providerId: gotrade.id,
        kind: 'BROKERAGE',
        currency: 'USD',
        externalAccountNo: '933194961',
        sortOrder: 10,
      },
    });

console.log('  providers seeded:', providers.map((p) => p.value).join(', '));
console.log(`  account: #${account.id} "${account.name}"  ${account.currency}  acct-no ${account.externalAccountNo}`);
await prisma.$disconnect();
