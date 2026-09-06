import { redirect } from 'next/navigation';
import { auth } from '@/auth';

/**
 * Server-side gate for every protected page.
 *
 * Defence in depth, on purpose. src/middleware.ts already blocks unauthenticated
 * requests, but middleware is ONE point of failure and it failed silently here:
 * the file sat at the project root, where Next ignores it when a src/ directory
 * exists, and /accounts served the account name and number to anyone who asked.
 * A page that renders financial data should not depend on a config file being in
 * the right folder.
 */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  return session.user;
}
