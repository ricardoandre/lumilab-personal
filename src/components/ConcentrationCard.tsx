'use client';

import { Card, Typography, Space, Grid } from 'antd';
import type { Overview, StockRow } from '@/lib/gotrade/report';
import { StockIcon } from './StockIcon';
import { usd, Money } from './money';

/**
 * Every holding's share of the account, largest first, with cash included.
 *
 * Cash is part of it deliberately: "SPY is 48% of my stocks" and "SPY is 48% of
 * my account" are different claims, and only the second one tells you how
 * exposed you actually are.
 *
 * Drawn as bars rather than a pie — a pie makes 12% and 14% indistinguishable,
 * and this list is read on a phone.
 */
export function ConcentrationCard({ overview, stocks }: { overview: Overview; stocks: StockRow[] }) {
  const screens = Grid.useBreakpoint();
  const rows = [...stocks].sort((a, b) => b.weightPct - a.weightPct);
  const cashPct = overview.cashPct;
  const top = rows[0];

  return (
    <Card title="Concentration" size={screens.lg ? 'default' : 'small'}>
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        {rows.map((s) => (
          <Bar key={s.symbol} label={s.symbol} name={s.name} pct={s.weightPct} value={s.marketValue} />
        ))}
        <Bar label="Cash" pct={cashPct} value={overview.cash} muted />

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

function Bar({
  label, name, pct, value, muted,
}: { label: string; name?: string | null; pct: number; value: number; muted?: boolean }) {
  const width = Math.max(pct * 100, 0.5); // keep a sliver visible for tiny holdings
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
        {muted ? (
          <span style={{ width: 22, height: 22, borderRadius: 6, background: '#d9d3c8', flexShrink: 0 }} />
        ) : (
          <StockIcon symbol={label} size={22} />
        )}
        <span style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
          {name && (
            <span style={{ display: 'block', fontSize: 11, color: '#726c63', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </span>
          )}
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {(pct * 100).toFixed(1)}%
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#726c63', whiteSpace: 'nowrap', minWidth: 76, textAlign: 'right' }}>
          {usd(value)}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: '#efebe3', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${width}%`, background: muted ? '#b9b3a8' : '#26344b' }} />
      </div>
    </div>
  );
}
