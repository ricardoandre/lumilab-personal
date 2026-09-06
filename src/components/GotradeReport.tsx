'use client';

import { Card, Typography, Space, Segmented, Empty, Grid, Tag } from 'antd';
import { useState } from 'react';
import type { MonthRow, StockRow } from '@/lib/gotrade/report';
import { ResponsiveRows } from './ResponsiveRows';
import { Pct, Money } from './money';

export function GotradeReport({
  accountName, months, stocks,
}: { accountName: string; months: MonthRow[]; stocks: StockRow[] }) {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;
  const [year, setYear] = useState<string>('All');

  if (!months.length) return <Card><Empty description="No statements imported yet." /></Card>;

  const years = ['All', ...[...new Set(months.map((m) => m.period.slice(0, 4)))].reverse()];
  const shown = (year === 'All' ? months : months.filter((m) => m.period.startsWith(year)));

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>{accountName} — Report</Typography.Title>

      <Card
        title="Individual stocks"
        styles={{ body: { padding: 0 } }}
        size={isMobile ? 'small' : 'default'}
      >
        <ResponsiveRows<StockRow & { key: string }>
          rows={stocks.map((s) => ({ ...s, key: s.symbol }))}
          fields={[
            { key: 'sym', label: 'Symbol', primary: true, render: (r) => <Tag style={{ marginInlineEnd: 0 }}>{r.symbol}</Tag> },
            { key: 'ann', label: 'Return a year', render: (r) => <Pct v={r.annualisedPct} bold /> },
            { key: 'tot', label: 'Total return', render: (r) => <Pct v={r.returnPct} /> },
            { key: 'val', label: 'Value now', render: (r) => <Money v={r.marketValue} /> },
            { key: 'cost', label: 'You paid', render: (r) => <Money v={r.costBasis} /> },
            { key: 'unr', label: 'Unrealised', render: (r) => <Money v={r.unrealized} /> },
            { key: 'div', label: 'Dividends', render: (r) => <Money v={r.dividends} zeroDim /> },
            { key: 'qty', label: 'Shares', render: (r) => r.quantity },
            { key: 'held', label: 'Held since', render: (r) => r.heldSince ?? '—' },
            { key: 'name', label: 'Name', hideOnMobile: true, render: (r) => r.name ?? '—' },
          ]}
        />
      </Card>

      <Card
        title="Month by month"
        extra={<Segmented size="small" options={years} value={year} onChange={(v) => setYear(v as string)} />}
        styles={{ body: { padding: 0 } }}
        size={isMobile ? 'small' : 'default'}
      >
        <ResponsiveRows<MonthRow & { key: string }>
          rows={[...shown].reverse().map((m) => ({ ...m, key: m.period }))}
          fields={[
            { key: 'p', label: 'Month', primary: true, render: (r) => r.period },
            { key: 'ret', label: 'Return', render: (r) => <Pct v={r.returnPct} bold /> },
            { key: 'val', label: 'Portfolio value', render: (r) => <Money v={r.portfolioValue} /> },
            { key: 'gain', label: 'Gain', render: (r) => <Money v={r.gain} /> },
            { key: 'paid', label: 'Paid in', render: (r) => <Money v={r.contributions} zeroDim /> },
            { key: 'inc', label: 'Dividends', render: (r) => <Money v={r.income} zeroDim /> },
            { key: 'cash', label: 'Cash', hideOnMobile: true, render: (r) => <Money v={r.cash} /> },
            { key: 'hold', label: 'Holdings', hideOnMobile: true, render: (r) => <Money v={r.holdingsValue} /> },
          ]}
        />
      </Card>

      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        Returns are time-weighted, so money you pay in is never counted as a gain, and each
        contribution is weighted by how long it was actually invested. Stock returns include
        dividends received — a stock held for income looks like a failure without them.
        &quot;Return a year&quot; spreads the total return over how long you have held it, so a
        recent position and a four-year one can be compared; it is left blank under three months,
        where annualising a few weeks produces confident nonsense.
      </Typography.Paragraph>
    </Space>
  );
}
