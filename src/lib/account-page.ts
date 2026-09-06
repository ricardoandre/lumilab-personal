import { prisma } from '@/lib/prisma';

/**
 * Resolve an account from a URL segment.
 *
 * A mistyped id must 404, not 500: BigInt('abc') throws, and the id comes
 * straight from a URL anyone can edit.
 */
export async function loadAccount(id: string) {
  let accountId: bigint;
  try {
    accountId = BigInt(id);
  } catch {
    return { accountId: 0n, account: null };
  }
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { provider: true },
  });
  return { accountId, account };
}
