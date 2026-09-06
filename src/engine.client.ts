'use client';
import { configureEngine } from '@lumilab/engine/runtime';
import { NAV_GROUPS } from '@/lib/nav-structure';

// Client half: the sidebar only. AppSider reads NAV_GROUPS in the browser.
configureEngine({ navGroups: NAV_GROUPS });
