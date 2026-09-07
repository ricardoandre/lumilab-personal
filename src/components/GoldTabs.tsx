'use client';
import { InnerHeaderTabs } from '@lumilab/engine/ui/InnerHeaderTabs';

export function GoldTabs({ accountId }: { accountId: string }) {
  return (
    <InnerHeaderTabs
      items={[
        { key: 'dashboard', label: 'Dashboard', href: `/accounts/${accountId}/gold` },
        { key: 'transactions', label: 'Transactions', href: `/accounts/${accountId}/gold/transactions` },
        { key: 'report', label: 'Report', href: `/accounts/${accountId}/gold/report` },
      ]}
    />
  );
}
