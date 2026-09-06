import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.APP_DB_URL) });
const email = process.argv[2];
const password = process.argv[3];
// Name was hardcoded to 'Andre', which duly labelled the second user "Andre".
const nickname = process.argv[4] ?? email.split('@')[0];
const isAdmin = process.argv[5] !== 'false';
if (!email || !password) {
  console.error('usage: node scripts/seed-user.mjs <email> <password> [nickname] [isAdmin]');
  process.exit(1);
}

const passwordHash = await bcrypt.hash(password, 10);
const user = await prisma.user.upsert({
  where: { email },
  update: { passwordHash, isAdmin },
  create: { email, nickname, passwordHash, isAdmin },
});
console.log(`  user #${user.id} ${user.email} — ${user.nickname} (admin: ${user.isAdmin})`);
await prisma.$disconnect();
