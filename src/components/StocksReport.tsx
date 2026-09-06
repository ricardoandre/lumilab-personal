'use client';

import { useMemo, useState } from 'react';
import { Card, Typography, Space, Segmented, Tag, Grid } from 'antd';
import type { StockRow } from '@/lib/gotrade/report';
import { ResponsiveRows } from './ResponsiveRows';
import { Pct, Money } from './money';

type SortKey = 'Return' | 'Money in' | 'Dividends';

export function StocksReport({ stocks }: { stocks: StockRow[] }) {
  const screens = Grid.useBreakpoint();
  const [sort, setSort] = useState<SortKey>('Return');

  const rows = useMemo(() => {
    const copy = [...stocks];
    copy.sort((a, b) => {
      if (sort === 'Return') return (b.returnPct ?? -Infinity) - (a.returnPct ?? -Infinity);
      if (sort === 'Money in') return b.costBasis - a.costBasis;
      return b.dividends - a.dividends;
    });
    return copy.map((s) => ({ ...s, key: s.symbol }));
  }, [stocks, sort]);

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Segmented
        block={!screens.sm}
        size={screens.lg ? 'middle' : 'small'}
        options={['Return', 'Money in', 'Dividends'] as SortKey[]}
        value={sort}
        onChange={(v) => setSort(v as SortKey)}
      />
      <Card styles={{ body: { padding: 0 } }} size={screens.lg ? 'default' : 'small'}>
        <ResponsiveRows<StockRow & { key: string }>
          rows={rows}
          fields={[
            { key: 'sym', label: 'Symbol', primary: true, render: (r) => <Tag style={{ marginInlineEnd: 0 }}>{r.symbol}</Tag> },
            { key: 'ret', label: 'Total return', render: (r) => <Pct v={r.returnPct} bold /> },
            { key: 'ann', label: 'Return a year', render: (r) => <Pct v={r.annualisedPct} /> },
            { key: 'val', label: 'Portfolio value', render: (r) => <Money v={r.marketValue} /> },
            { key: 'cost', label: 'Money in', render: (r) => <Money v={r.costBasis} /> },
            { key: 'unr', label: 'Unrealised', render: (r) => <Money v={r.unrealized} /> },
            { key: 'div', label: 'Dividends', render: (r) => <Money v={r.dividends} zeroDim /> },
            { key: 'qty', label: 'Shares', render: (r) => r.quantity },
            { key: 'held', label: 'Held since', render: (r) => r.heldSince ?? '—' },
            { key: 'name', label: 'Name', hideOnMobile: true, render: (r) => r.name ?? '—' },
          ]}
        />
      </Card>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        Returns include dividends received — a stock held for income looks like a failure without them.
        &quot;Return a year&quot; spreads the total return over how long you have held it, so a recent
        position and a four-year one can be compared; it stays blank under three months, where
        annualising a few weeks produces confident nonsense.
      </Typography.Paragraph>
    </Space>
  );
}
