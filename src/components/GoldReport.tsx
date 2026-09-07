'use client';

import { Card, Grid, Space, Typography, Tag } from 'antd';
import type { GoldOverview } from '@/lib/gold/report';
import { ResponsiveRows } from './ResponsiveRows';
import { PieChart, type Slice } from './PieChart';
import { Pct } from './money';

const idr = (n: number) => (n < 0 ? '-' : '') + 'Rp ' + Math.round(Math.abs(n)).toLocaleString('id-ID');
const Money = ({ v }: { v: number }) => (
  <span style={{ fontVariantNumeric: 'tabular-nums', color: v < 0 ? '#a8071a' : undefined }}>{idr(v)}</span>
);

interface OwnerRow {
  key: string; owner: string; grams: number; invested: number; valueNow: number; gain: number;
  returnPct: number | null; share: number;
}

/** Gold's report: who owns what, and every purchase in full. */
export function GoldReport({ data }: { data: GoldOverview }) {
  const screens = Grid.useBreakpoint();
  const small = !screens.lg;

  const rows: OwnerRow[] = data.byOwner.map((o) => ({
    key: o.owner, owner: o.owner, grams: o.grams, invested: o.invested,
    valueNow: o.valueNow, gain: o.gain,
    returnPct: o.invested > 0 ? o.gain / o.invested : null,
    share: data.valueNow > 0 ? o.valueNow / data.valueNow : 0,
  }));

  const slices: Slice[] = rows.filter((r) => r.valueNow > 0)
    .map((r) => ({ label: r.owner, value: r.valueNow, note: `${r.grams.toFixed(2)} g` }));

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="Whose gold" size={small ? 'small' : 'default'}>
        <PieChart slices={slices} centreValue={`${data.grams.toFixed(0)} g`} centreLabel="total" />
      </Card>

      <Card title="By owner" styles={{ body: { padding: 0 } }} size={small ? 'small' : 'default'}>
        <ResponsiveRows<OwnerRow>
          rows={rows}
          fields={[
            { key: 'owner', label: 'Owner', primary: true, render: (r) => <Tag style={{ marginInlineEnd: 0 }}>{r.owner}</Tag> },
            { key: 'g', label: 'Grams', render: (r) => r.grams.toFixed(2) },
            { key: 'share', label: 'Share', render: (r) => `${(r.share * 100).toFixed(1)}%` },
            { key: 'paid', label: 'Paid', render: (r) => <Money v={r.invested} /> },
            { key: 'now', label: 'Worth now', render: (r) => <Money v={r.valueNow} /> },
            { key: 'gain', label: 'Gain', render: (r) => <Money v={r.gain} /> },
            { key: 'ret', label: 'Return', render: (r) => <Pct v={r.returnPct} bold /> },
          ]}
        />
      </Card>

      <Card title="Every purchase" styles={{ body: { padding: 0 } }} size={small ? 'small' : 'default'}>
        <ResponsiveRows
          rows={data.lots.map((l) => ({ ...l, key: l.id }))}
          fields={[
            { key: 'date', label: 'Date', primary: true, render: (r) => r.date },
            { key: 'who', label: 'For', primary: true, render: (r) => r.remarks ?? '—' },
            { key: 'g', label: 'Grams', render: (r) => r.grams.toFixed(2) },
            { key: 'ppg', label: 'Price per gram', render: (r) => <Money v={r.pricePerGram} /> },
            { key: 'total', label: 'Total paid', render: (r) => <Money v={r.total} /> },
            { key: 'now', label: 'Worth now', render: (r) => <Money v={r.valueNow} /> },
            { key: 'gain', label: 'Gain', render: (r) => <Money v={r.gain} /> },
            { key: 'ret', label: 'Return', render: (r) => <Pct v={r.returnPct} bold /> },
          ]}
        />
      </Card>

      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        Valued at world spot, {data.pricePerGram === null ? '—' : idr(data.pricePerGram)} per gram.
        Indonesian retail gold sells above spot and buys back below it, so a real sale would fetch less.
      </Typography.Paragraph>
    </Space>
  );
}
