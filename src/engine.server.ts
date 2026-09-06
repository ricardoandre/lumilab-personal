import 'server-only';
import { configureEngine } from '@lumilab/engine/runtime';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { NAV_GROUPS } from '@/lib/nav-structure';

// Server half of the engine config. `db` and `auth` must never reach the browser
// bundle; the client half lives in engine.client.ts and supplies only the nav.
configureEngine({ db: prisma, auth, navGroups: NAV_GROUPS });
