import { prisma } from '@/lib/prisma';
import { missingMonths, failedImports } from '@/lib/gotrade/report';

/** Data-health context every report tab shows in its header. */
export async function reportHealth(accountId: bigint) {
  const [missing, failed, newest] = await Promise.all([
    missingMonths(prisma, accountId),
    failedImports(prisma, accountId),
    prisma.statementImport.findFirst({
      where: { accountId, status: 'ok' },
      orderBy: { periodEnd: 'desc' },
      select: { periodEnd: true },
    }),
  ]);
  const asAt = newest?.periodEnd
    ? (() => {
        const end = newest.periodEnd!;
        const now = new Date();
        return {
          period: end.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
          monthsBehind: Math.max(0, (now.getUTCFullYear() - end.getUTCFullYear()) * 12 + (now.getUTCMonth() - end.getUTCMonth())),
        };
      })()
    : null;
  return { missing, failed, asAt };
}
