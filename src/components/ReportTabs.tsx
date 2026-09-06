'use client';
import { InnerHeaderTabs } from '@lumilab/engine/ui/InnerHeaderTabs';

/** Same bar rendered at the top of every tab's page — each tab is a real,
 *  bookmarkable route, not a client-side content switch. */
export function ReportTabs({ accountId }: { accountId: string }) {
  return (
    <InnerHeaderTabs
      items={[
        { key: 'stocks', label: 'Individual stocks', href: `/accounts/${accountId}/report` },
        { key: 'transactions', label: 'Transactions', href: `/accounts/${accountId}/report/transactions` },
      ]}
    />
  );
}
