'use client';
import { InnerHeaderTabs } from '@lumilab/engine/ui/InnerHeaderTabs';

export function AccountsTabs() {
  return (
    <InnerHeaderTabs
      items={[
        { key: 'list', label: 'Account list', href: '/accounts' },
        { key: 'projection', label: 'Projection', href: '/accounts/projection' },
      ]}
    />
  );
}
