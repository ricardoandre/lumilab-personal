import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.APP_DB_URL) });
const email = process.argv[2];
const password = process.argv[3];
if (!email || !password) { console.error('usage: node scripts/seed-user.mjs <email> <password>'); process.exit(1); }

const passwordHash = await bcrypt.hash(password, 10);
const user = await prisma.user.upsert({
  where: { email },
  update: { passwordHash, isAdmin: true },
  create: { email, nickname: 'Andre', passwordHash, isAdmin: true },
});
console.log(`  user #${user.id} ${user.email} (admin: ${user.isAdmin})`);
await prisma.$disconnect();
