'use client';

import { useState } from 'react';
import { Card, Grid, Segmented, Space, Typography, Drawer } from 'antd';
import type { GoldLot } from '@/lib/gold/report';
import { Pct } from './money';

const idr = (n: number) => (n < 0 ? '-' : '') + 'Rp ' + Math.round(Math.abs(n)).toLocaleString('id-ID');
const idrShort = (n: number) => {
  if (Math.abs(n) >= 1e9) return `Rp ${(n / 1e9).toFixed(2)} M`;
  if (Math.abs(n) >= 1e6) return `Rp ${(n / 1e6).toFixed(0)} jt`;
  return idr(n);
};

type Rank = 'Best a year' | 'Most earned' | 'Best return';

/**
 * Which purchases actually did the work.
 *
 * A flat list of every purchase answers "what did I buy"; this answers "which
 * ones were good", which is the question a dashboard is for. The full ledger
 * moved to its own Transactions tab.
 *
 * "Best a year" is the default because it is the only fair comparison between a
 * 2016 lot and one bought in January: total return simply rewards whichever has
 * been held longest.
 */
export function GoldBestPurchases({ lots, pricePerGram }: { lots: GoldLot[]; pricePerGram: number | null }) {
  const screens = Grid.useBreakpoint();
  const [rank, setRank] = useState<Rank>('Best a year');
  const [open, setOpen] = useState<GoldLot | null>(null);

  const annualised = (l: GoldLot) => {
    const yrs = (Date.now() - new Date(l.date).getTime()) / (365.25 * 24 * 3600 * 1000);
    if (yrs < 0.25 || l.total <= 0) return null;
    return Math.pow(l.valueNow / l.total, 1 / yrs) - 1;
  };

  const sorted = [...lots].sort((a, b) => {
    if (rank === 'Most earned') return b.gain - a.gain;
    if (rank === 'Best return') return (b.returnPct ?? -Infinity) - (a.returnPct ?? -Infinity);
    return (annualised(b) ?? -Infinity) - (annualised(a) ?? -Infinity);
  });

  return (
    <>
      <Card
        title="Which purchases did best"
        size={screens.lg ? 'default' : 'small'}
        extra={
          <Segmented size="small" options={['Best a year', 'Most earned', 'Best return'] as Rank[]}
            value={rank} onChange={(v) => setRank(v as Rank)} />
        }
        styles={{ body: { padding: 0 } }}
      >
        {sorted.map((l, i) => (
          <button
            key={l.id}
            onClick={() => setOpen(l)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
              padding: '10px 14px', background: 'none', cursor: 'pointer',
              border: 'none', borderTop: i === 0 ? 'none' : '1px solid #f0ece4',
            }}
          >
            <span style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0, fontSize: 11, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: i === 0 ? '#26344b' : '#efebe3', color: i === 0 ? '#fff' : '#726c63',
            }}>{i + 1}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{l.remarks ?? '—'}</span>
              <span style={{ display: 'block', fontSize: 11, color: '#726c63' }}>
                {l.date} · {l.grams.toFixed(2)} g
              </span>
            </span>
            <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: 13 }}>
                {rank === 'Most earned' ? idrShort(l.gain)
                  : rank === 'Best return' ? <Pct v={l.returnPct} bold />
                  : <Pct v={annualised(l)} bold />}
              </span>
              <span style={{ fontSize: 11, color: '#726c63' }}>
                {rank === 'Most earned' ? 'earned' : rank === 'Best return' ? 'total' : 'a year'}
              </span>
            </span>
          </button>
        ))}
      </Card>

      <Drawer
        title={open ? `${open.remarks ?? 'Purchase'} · ${open.date}` : ''}
        open={!!open}
        onClose={() => setOpen(null)}
        placement={screens.lg ? 'right' : 'bottom'}
        width={screens.lg ? 460 : undefined}
        height={screens.lg ? undefined : '65%'}
      >
        {open && (
          <Space direction="vertical" size={0} style={{ width: '100%' }}>
            <Line label="Weight" value={`${open.grams.toFixed(2)} g`} />
            <Line label="Price per gram then" value={idr(open.pricePerGram)} />
            <Line label="Price per gram now" value={pricePerGram === null ? '—' : idr(pricePerGram)} />
            <Line label="Total paid" value={idr(open.total)} divider />
            <Line label="Worth now" value={idr(open.valueNow)} />
            <Line label="Gain" value={idr(open.gain)} strong />
            <Line label="Total return" value={<Pct v={open.returnPct} bold />} />
            <Line label="Return a year" value={<Pct v={annualised(open)} />} />
            <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 16 }}>
              &quot;Return a year&quot; is blank under three months — annualising a few weeks
              produces confident nonsense.
            </Typography.Paragraph>
          </Space>
        )}
      </Drawer>
    </>
  );
}

function Line({ label, value, strong, divider }: { label: string; value: React.ReactNode; strong?: boolean; divider?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0',
      borderTop: divider ? '1px solid #e7e2d9' : undefined,
    }}>
      <span style={{ color: '#726c63' }}>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: strong ? 600 : 400 }}>{value}</span>
    </div>
  );
}
