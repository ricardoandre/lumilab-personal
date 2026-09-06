import type { NextAuthConfig } from 'next-auth';

// Edge-safe: no providers or imports that touch Prisma. middleware.ts decodes the
// JWT with this alone, so the session shape is defined ONCE and shared rather
// than duplicated between edge and node (where the two copies would drift).
export const authConfig: NextAuthConfig = {
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.isAdmin = token.isAdmin as boolean;
        session.user.impersonatedBy = (token.realEmail as string | null | undefined) ?? null;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      // Everything is private except the login page — this is one person's
      // financial records, so the default is deny, not allow.
      const isLoggedIn = !!auth?.user;
      if (nextUrl.pathname.startsWith('/login')) return true;
      if (nextUrl.pathname.startsWith('/api/auth')) return true;
      return isLoggedIn;
    },
  },
};
