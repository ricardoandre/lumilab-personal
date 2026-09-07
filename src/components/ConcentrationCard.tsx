'use client';

import { Card, Typography, Space, Grid } from 'antd';
import type { Overview, StockRow } from '@/lib/gotrade/report';
import { PieChart, type Slice } from './PieChart';
import { usd } from './money';

/**
 * Every holding's share of the account, largest first, with cash included.
 *
 * Cash is part of it deliberately: "SPY is 48% of my stocks" and "SPY is 48% of
 * my account" are different claims, and only the second one tells you how
 * exposed you actually are.
 *
 * Drawn as a donut with a legend: the ring gives the proportions at a glance and
 * the list carries the actual percentages, since a wedge alone cannot be read to
 * one decimal place.
 */
export function ConcentrationCard({ overview, stocks }: { overview: Overview; stocks: StockRow[] }) {
  const screens = Grid.useBreakpoint();
  const rows = [...stocks].sort((a, b) => b.weightPct - a.weightPct);
  const top = rows[0];

  const slices: Slice[] = [
    ...rows.map((s) => ({ label: s.symbol, value: s.marketValue, note: usd(s.marketValue) })),
    { label: 'Cash', value: Math.max(overview.cash, 0), color: '#b9b3a8', note: usd(overview.cash) },
  ].filter((s) => s.value > 0);

  return (
    <Card title="Concentration" size={screens.lg ? 'default' : 'small'}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <PieChart slices={slices} centreValue={`${rows.length}`} centreLabel="holdings" />
        {top && top.weightPct > 0.3 && (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            <strong>{top.symbol} is {(top.weightPct * 100).toFixed(1)}% of this account.</strong> Not a
            mistake in itself, but your result now depends more on that one holding than on
            everything else combined.
          </Typography.Text>
        )}
      </Space>
    </Card>
  );
}
