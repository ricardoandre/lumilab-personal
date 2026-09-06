'use client';

import { Grid } from 'antd';
import type { YearVsBench } from '@/lib/gotrade/report';
import { Pct, Money } from './money';

/**
 * The year at a glance.
 *
 * "New invested fund" is here because without it the year reads as a triumph:
 * Lisa's 2026 portfolio nearly doubled while the actual return was +4.21% — the
 * rest was money she paid in. Value growth and investment performance are
 * different things, and a year card that shows only the first is misleading.
 */
export function YearMetrics({ year, cash }: { year: YearVsBench; cash: number }) {
  const screens = Grid.useBreakpoint();
  const prev = Number(year.year) - 1;

  const items: { label: string; value: React.ReactNode }[] = [
    { label: `End ${prev} value`, value: <Money v={year.startValue} /> },
    { label: 'New invested fund', value: <Money v={year.contributions} zeroDim /> },
    { label: 'Current portfolio value', value: <Money v={year.endValue} /> },
    { label: 'Remaining cash', value: <Money v={cash} /> },
    { label: 'Total return amount', value: <Money v={year.gain} /> },
    { label: `Return ${year.year}`, value: <Pct v={year.returnPct} bold /> },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: screens.lg ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
      gap: 12,
      marginBottom: 12,
    }}>
      {items.map((it) => (
        <div key={it.label}>
          <div style={{ fontSize: 12, color: '#726c63', lineHeight: 1.3 }}>{it.label}</div>
          <div style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{it.value}</div>
        </div>
      ))}
      <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#726c63' }}>
        SPY over the same months: <Pct v={year.benchmarkPct} />
      </div>
    </div>
  );
}
