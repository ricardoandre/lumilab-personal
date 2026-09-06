'use client';
import { InnerHeaderTabs } from '@lumilab/engine/ui/InnerHeaderTabs';

export function ReportTabs({ accountId }: { accountId: string }) {
  return (
    <InnerHeaderTabs
      items={[
        { key: 'overview', label: 'Overview', href: `/accounts/${accountId}/report` },
        { key: 'stocks', label: 'Individual stocks', href: `/accounts/${accountId}/report/stocks` },
        { key: 'transactions', label: 'Transactions', href: `/accounts/${accountId}/report/transactions` },
      ]}
    />
  );
}
