import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const adapter = new PrismaMariaDb(process.env.APP_DB_URL!);

/** The database this process is actually connected to — derived, never hardcoded. */
export function appDbName(): string {
  return new URL(process.env.APP_DB_URL!).pathname.replace(/^\//, '');
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
