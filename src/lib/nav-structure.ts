import type { NavGroup } from '@lumilab/engine/nav-types';

/**
 * The sidebar.
 *
 * Entries with no `href` render as non-clickable placeholders on purpose. Next
 * PREFETCHES every visible link, so a nav entry pointing at an unbuilt page 404s
 * on page load without anyone clicking it — which is how /imports was caught,
 * against the live domain, by the browser check. A route only gets an href once
 * the page exists.
 *
 * Andre's requirement is that the menu IS the list of accounts ("the menu on the
 * left will be list of all finance and investment available"), so account
 * entries will be generated from the Account table. This static skeleton is what
 * surrounds them.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    entries: [{ label: 'Dashboard', href: '/' }],
  },
  {
    label: 'Accounts',
    entries: [
      { label: 'All Accounts', href: '/accounts' },
      { label: 'Statement Imports', badge: 'next' },
    ],
  },
  {
    label: 'Admin',
    entries: [
      { label: 'Field Options', badge: 'soon' },
      { label: 'Users', badge: 'soon' },
    ],
  },
];
