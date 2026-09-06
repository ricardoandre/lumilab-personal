'use client';

import { useMemo, useState } from 'react';
import { Card, Space, Segmented, Tag, Grid, Typography } from 'antd';
import { ResponsiveRows } from './ResponsiveRows';
import { Money } from './money';

export interface TxRow {
  key: string; date: string; type: string; symbol: string | null;
  quantity: number | null; price: number | null; amount: number; description: string | null;
}

const COLOR: Record<string, string> = {
  BUY: 'blue', SELL: 'purple', DIVIDEND: 'green', TAX: 'red',
  DEPOSIT: 'cyan', WITHDRAWAL: 'orange', FEE: 'red', INTEREST: 'green', JOURNAL: 'default',
};

export function TransactionsReport({ rows }: { rows: TxRow[] }) {
  const screens = Grid.useBreakpoint();
  const [filter, setFilter] = useState<string>('All');

  const types = useMemo(() => ['All', ...[...new Set(rows.map((r) => r.type))].sort()], [rows]);
  const shown = filter === 'All' ? rows : rows.filter((r) => r.type === filter);

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Segmented
        size={screens.lg ? 'middle' : 'small'}
        options={types}
        value={filter}
        onChange={(v) => setFilter(v as string)}
      />
      <Card styles={{ body: { padding: 0 } }} size={screens.lg ? 'default' : 'small'}>
        <ResponsiveRows<TxRow>
          rows={shown}
          emptyText="No transactions of that kind."
          fields={[
            { key: 'date', label: 'Date', primary: true, render: (r) => r.date },
            { key: 'type', label: 'Type', primary: true, render: (r) => <Tag color={COLOR[r.type] ?? 'default'} style={{ marginInlineEnd: 0 }}>{r.type.toLowerCase()}</Tag> },
            { key: 'sym', label: 'Symbol', render: (r) => r.symbol ?? '—' },
            { key: 'amt', label: 'Amount', render: (r) => <Money v={r.amount} /> },
            { key: 'qty', label: 'Shares', render: (r) => (r.quantity === null ? '—' : r.quantity) },
            { key: 'price', label: 'Price', render: (r) => (r.price === null ? '—' : <Money v={r.price} />) },
          ]}
        />
      </Card>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        Every row read from your statements, newest first. Amounts are signed: positive is money
        into the account.
      </Typography.Paragraph>
    </Space>
  );
}
