'use client';

import { Table, Tag, Card, Typography, Space } from 'antd';

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
export function AccountsTable({ rows }: { rows: AccountRow[] }) {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>Accounts</Typography.Title>
      <Card styles={{ body: { padding: 0 } }}>
    <Table
      dataSource={rows}
      pagination={false}
      scroll={{ x: true }}
      columns={[
        { title: 'Name', dataIndex: 'name' },
        {
          title: 'Provider',
          dataIndex: 'provider',
          render: (v: string, r: AccountRow) => <Tag color={r.color ?? undefined}>{v}</Tag>,
        },
        { title: 'Type', dataIndex: 'kind' },
        { title: 'Currency', dataIndex: 'currency' },
        { title: 'Account no.', dataIndex: 'accountNo' },
        { title: 'Statements', dataIndex: 'imports' },
        { title: 'Transactions', dataIndex: 'transactions' },
      ]}
    />
      </Card>
    </Space>
  );
}
