'use client';
import { configureEngine } from '@lumilab/engine/runtime';
import { NAV_GROUPS, ADMIN_NAV } from '@/lib/nav-structure';
import { BRAND } from '@/lib/brand';

// Client half: what AppSider and AppTitle render in the browser. No database.
configureEngine({ navGroups: NAV_GROUPS, adminNav: ADMIN_NAV, brand: BRAND });
