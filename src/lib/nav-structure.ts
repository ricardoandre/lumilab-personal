import type { NavGroup } from '@lumilab/engine/nav-types';

/**
 * The sidebar.
 *
 * Entries with no `href` render as non-clickable placeholders on purpose: Next
 * PREFETCHES every visible link, so an entry pointing at an unbuilt page 404s on
 * page load without anyone clicking it. A route gets an href once its page exists.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    entries: [{ label: 'Dashboard', href: '/' }],
  },
  {
    label: 'Accounts',
    entries: [
      { label: 'Account list', href: '/accounts' },
      { label: 'Projection', href: '/accounts/projection' },
    ],
  },
];

/**
 * Admin-only group, appended by the engine. Supplied here rather than by the
 * engine itself — the engine used to hardcode kanoapp's admin menu, so this app
 * showed a second group labelled ADMIN full of routes it does not have.
 */
export const ADMIN_NAV: NavGroup = {
  label: 'Admin',
  entries: [
    { label: 'Users', href: '/users' },
    { label: 'Field Options', href: '/field-options' },
  ],
};
