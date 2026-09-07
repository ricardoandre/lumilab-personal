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
                  {
                    label: 'All Accounts',
                    items: [
                      { label: 'Account list', href: '/accounts' },
                      { label: 'Projection', href: '/accounts/projection' },
                    ],
                  },
                  // Each account contributes a SUBGROUP: the account itself plus
                  // its tools. Andre: "each gotrade will have set of tools we are
                  // building" — so the tools hang off the account, not off a
                  // global menu that would grow with every account added.
                  ...d.accounts.map((a) => ({
                    label: a.name,
                    items: [
                      { label: 'Dashboard', href: `/accounts/${a.id}` },
                      {
                        label: 'Report',
                        href: `/accounts/${a.id}/report`,
                        // The Transactions tab is a sibling ROUTE under the same
                        // nav entry; without this the entry loses its highlight
                        // when you switch tabs.
                        matchHrefs: [
                          `/accounts/${a.id}/report/stocks`,
                          `/accounts/${a.id}/report/transactions`,
                        ],
                      },
                    ],
                  })),
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
