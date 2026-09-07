'use client';

import { Grid } from 'antd';

export interface Slice { label: string; value: number; color?: string; note?: string }

const PALETTE = [
  '#26344b', '#2f6f5e', '#7a3b2e', '#4a3b7a', '#7a6a2e',
  '#2e5f7a', '#6b2e5f', '#3f6b2e', '#7a4a2e', '#2e4a6b',
  '#8a6d3b', '#4b5d67',
];

/**
 * A donut, drawn as SVG arcs.
 *
 * Hand-drawn rather than pulled from a charting library: this is one figure on a
 * page read mostly on a phone, and 200KB of JavaScript for it would be the
 * heaviest thing in the app.
 *
 * A donut rather than a solid pie because the centre is the natural place for
 * the total, and the ring makes small slices easier to tell apart than wedges
 * converging on a point. The legend carries the numbers regardless — the shape
 * is for proportion, the list is for reading.
 */
export function PieChart({
  slices, total, centreLabel, centreValue,
}: { slices: Slice[]; total?: number; centreLabel?: string; centreValue?: string }) {
  const screens = Grid.useBreakpoint();
  const sum = total ?? slices.reduce((a, s) => a + s.value, 0);
  if (sum <= 0) return null;

  const size = 180;
  const r = 70;
  const stroke = 26;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const arcs = slices.map((s, i) => {
    const frac = s.value / sum;
    const dash = frac * circumference;
    const el = (
      <circle
        key={s.label}
        cx={c} cy={c} r={r}
        fill="none"
        stroke={s.color ?? PALETTE[i % PALETTE.length]}
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeDashoffset={-offset}
        // start at 12 o'clock rather than 3 o'clock, which is where people look
        transform={`rotate(-90 ${c} ${c})`}
      />
    );
    offset += dash;
    return el;
  });

  return (
    <div style={{
      display: 'flex', gap: 20, alignItems: 'center',
      flexDirection: screens.md ? 'row' : 'column',
    }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: 180, height: 180, flexShrink: 0 }} role="img"
           aria-label={slices.map((s) => `${s.label} ${((s.value / sum) * 100).toFixed(0)}%`).join(', ')}>
        {arcs}
        {centreValue && (
          <>
            <text x={c} y={c - 4} textAnchor="middle" fontSize="15" fontWeight="700" fill="#211f1c">{centreValue}</text>
            {centreLabel && <text x={c} y={c + 13} textAnchor="middle" fontSize="10" fill="#726c63">{centreLabel}</text>}
          </>
        )}
      </svg>

      <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
        {slices.map((s, i) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', minWidth: 0 }}>
            <span style={{
              width: 10, height: 10, borderRadius: 2, flexShrink: 0,
              background: s.color ?? PALETTE[i % PALETTE.length],
            }} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
              {s.label}
              {s.note && <span style={{ color: '#726c63', fontSize: 11 }}> · {s.note}</span>}
            </span>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {((s.value / sum) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
