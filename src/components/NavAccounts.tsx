'use client';

import { useEffect } from 'react';
import { configureEngine } from '@lumilab/engine/runtime';
import { NAV_GROUPS, ADMIN_NAV } from '@/lib/nav-structure';
import { BRAND } from '@/lib/brand';

/**
 * Rebuilds the sidebar with one entry per account, fetched once after mount.
 *
 * The engine takes navGroups as configuration, and AppSider reads them on the
 * client — which has no database — so the account rows arrive over the API and
 * are merged into the static skeleton here.
 */
export function NavAccounts() {
  useEffect(() => {
    let cancelled = false;
    fetch('/api/nav-accounts')
      .then((r) => (r.ok ? r.json() : { accounts: [] }))
      .then((d: { accounts: { id: string; name: string }[] }) => {
        if (cancelled || !d.accounts?.length) return;
        const groups = NAV_GROUPS.map((g) =>
          g.label === 'Accounts'
            ? {
                ...g,
                entries: [
                  { label: 'All Accounts', href: '/accounts' },
                  ...d.accounts.map((a) => ({ label: a.name, href: `/accounts/${a.id}` })),
                  { label: 'Statement Imports', badge: 'next' as const },
                ],
              }
            : g,
        );
        configureEngine({ navGroups: groups, adminNav: ADMIN_NAV, brand: BRAND });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return null;
}
