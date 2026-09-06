import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

// Edge JWT check only — see auth.config.ts.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
