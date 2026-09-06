'use client';

import { Tag, Card, Typography, Space } from 'antd';
import Link from 'next/link';
import { ResponsiveRows } from './ResponsiveRows';
import { NewAccountButton } from './NewAccountButton';
import { Money } from './money';

export interface AccountRow {
  key: string;
  name: string;
  provider: string;
  color: string | null;
  kind: string;
  currency: string;
  accountNo: string | null;
  imports: number;
  transactions: number;
}

/**
 * Client component purely so the column `render` callbacks live on the client.
 * Passing them down from the server page threw "Functions cannot be passed
 * directly to Client Components" — while the page still answered 200, which is
 * why this was invisible until the server log was read.
 */
export function AccountsTable({
  rows, providers,
}: { rows: AccountRow[]; providers: { value: string; label: string }[] }) {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Accounts</Typography.Title>
        <NewAccountButton providers={providers} />
      </div>
      <Card styles={{ body: { padding: 0 } }}>
        <ResponsiveRows<AccountRow>
          rows={rows}
          emptyText="No accounts yet — create one to get started."
          fields={[
            {
              key: 'name', label: 'Name', primary: true,
              render: (r) => <Link href={`/accounts/${r.key}`}>{r.name}</Link>,
            },
            { key: 'provider', label: 'Provider', render: (r) => <Tag color={r.color ?? undefined}>{r.provider}</Tag> },
            { key: 'kind', label: 'Type', render: (r) => r.kind },
            { key: 'ccy', label: 'Currency', render: (r) => r.currency },
            { key: 'no', label: 'Account no.', render: (r) => r.accountNo ?? 'set on first upload' },
            { key: 'imports', label: 'Statements', render: (r) => r.imports },
            { key: 'tx', label: 'Transactions', render: (r) => r.transactions },
          ]}
        />
      </Card>
    </Space>
  );
}
