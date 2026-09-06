import 'server-only';
import { configureEngine } from '@lumilab/engine/runtime';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { NAV_GROUPS, ADMIN_NAV } from '@/lib/nav-structure';
import { BRAND } from '@/lib/brand';

// Server half. `db` and `auth` must never reach the browser bundle; the client
// half (engine.client.ts) supplies the nav and brand only.
configureEngine({ db: prisma, auth, navGroups: NAV_GROUPS, adminNav: ADMIN_NAV, brand: BRAND });
