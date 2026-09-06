import type { NavGroup } from '@lumilab/engine/nav-types';

/**
 * The sidebar. Deliberately thin for now: Andre's requirement is that the menu
 * IS the list of accounts ("the menu on the left will be list of all finance and
 * investment available"), so the account entries will be generated from the
 * Account table rather than written here. This static skeleton is what surrounds
 * them.
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
      { label: 'Statement Imports', href: '/imports', badge: 'next' },
    ],
  },
  {
    label: 'Admin',
    entries: [
      { label: 'Field Options', href: '/field-options' },
      { label: 'Users', href: '/users' },
    ],
  },
];
