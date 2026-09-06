'use client';

import { useMemo, useState } from 'react';
import { Card, Typography, Space, Segmented, Tag, Grid } from 'antd';
import type { StockRow } from '@/lib/gotrade/report';
import { ResponsiveRows } from './ResponsiveRows';
import { Pct, Money } from './money';
import { StockLabel } from './StockIcon';

type SortKey = 'Return a year' | 'Total return' | 'Portfolio value' | 'Money in' | 'Dividends' | 'Share of account';

// Sorting always puts the biggest first, and a missing value sorts LAST rather
// than as zero — a stock too new to annualise is unknown, not worst.
const SORTS: Record<SortKey, (a: StockRow, b: StockRow) => number> = {
  'Return a year': (a, b) => (b.annualisedPct ?? -Infinity) - (a.annualisedPct ?? -Infinity),
  'Total return': (a, b) => (b.returnPct ?? -Infinity) - (a.returnPct ?? -Infinity),
  'Portfolio value': (a, b) => b.marketValue - a.marketValue,
  'Money in': (a, b) => b.costBasis - a.costBasis,
  Dividends: (a, b) => b.dividends - a.dividends,
  'Share of account': (a, b) => b.weightPct - a.weightPct,
};

export function StocksReport({ stocks }: { stocks: StockRow[] }) {
  const screens = Grid.useBreakpoint();
  const [sort, setSort] = useState<SortKey>('Return a year');

  const rows = useMemo(
    () => [...stocks].sort(SORTS[sort]).map((s) => ({ ...s, key: s.symbol })),
    [stocks, sort],
  );

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {/* Five options do not fit a phone as a segmented strip, so it scrolls
          horizontally inside its own container rather than widening the page. */}
      <div style={{ overflowX: 'auto', paddingBottom: 2 }}>
        <Segmented
          size={screens.lg ? 'middle' : 'small'}
          options={Object.keys(SORTS) as SortKey[]}
          value={sort}
          onChange={(v) => setSort(v as SortKey)}
        />
      </div>
      <Card styles={{ body: { padding: 0 } }} size={screens.lg ? 'default' : 'small'}>
        <ResponsiveRows<StockRow & { key: string }>
          rows={rows}
          fields={[
            { key: 'sym', label: 'Stock', primary: true, render: (r) => <StockLabel symbol={r.symbol} name={r.name} /> },
            { key: 'ret', label: 'Total return', render: (r) => <Pct v={r.returnPct} bold /> },
            { key: 'ann', label: 'Return a year', render: (r) => <Pct v={r.annualisedPct} /> },
            { key: 'val', label: 'Portfolio value', render: (r) => <Money v={r.marketValue} /> },
            { key: 'weight', label: 'Share of account', render: (r) => `${(r.weightPct * 100).toFixed(1)}%` },
            { key: 'cost', label: 'Money in', render: (r) => <Money v={r.costBasis} /> },
            { key: 'unr', label: 'Unrealised', render: (r) => <Money v={r.unrealized} /> },
            { key: 'div', label: 'Dividends', render: (r) => <Money v={r.dividends} zeroDim /> },
            { key: 'yield', label: 'Dividend yield', render: (r) => <Pct v={r.dividendYield} /> },
            { key: 'qty', label: 'Shares', render: (r) => r.quantity },
            { key: 'held', label: 'Held since', render: (r) => r.heldSince ?? '—' },
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
