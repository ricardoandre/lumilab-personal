'use client';

import { Card, Typography, Grid } from 'antd';
import type { MonthRow } from '@/lib/gotrade/report';
import { usd0 } from './money';

/**
 * Portfolio value over time, split into money paid in versus money earned.
 *
 * Hand-drawn SVG rather than a charting library: one chart does not justify
 * ~200KB of JavaScript on a phone, which is where this is mostly read.
 */
export function PortfolioChart({ months, bare }: { months: MonthRow[]; bare?: boolean }) {
  const screens = Grid.useBreakpoint();
  const h = screens.lg ? 220 : 160;
  const w = 720; // viewBox units; the SVG scales to its container
  const pad = { l: 4, r: 4, t: 10, b: 18 };

  if (months.length < 2) return null;

  // Cumulative contributions alongside total value: the gap between the two IS
  // the investment gain, which is the thing worth seeing.
  let running = 0;
  const pts = months.map((m) => {
    running += m.contributions;
    return { period: m.period, value: m.portfolioValue, paid: running };
  });

  const max = Math.max(...pts.map((p) => Math.max(p.value, p.paid))) * 1.08;
  const x = (i: number) => pad.l + (i / (pts.length - 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (h - pad.t - pad.b);

  const line = (get: (p: (typeof pts)[number]) => number) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(get(p)).toFixed(1)}`).join(' ');
  const area =
    `M${x(0).toFixed(1)},${y(pts[0].value).toFixed(1)} ` +
    pts.map((p, i) => `L${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ') +
    ` L${x(pts.length - 1).toFixed(1)},${y(pts[pts.length - 1].paid).toFixed(1)} ` +
    [...pts].reverse().map((p, i) => `L${x(pts.length - 1 - i).toFixed(1)},${y(p.paid).toFixed(1)}`).join(' ') + ' Z';

  const last = pts[pts.length - 1];
  const years = [...new Set(pts.map((p) => p.period.slice(0, 4)))];

  const inner = (
    <>
      {!bare && <Typography.Text strong>Portfolio value</Typography.Text>}
      <div style={{ display: 'flex', gap: 16, margin: '4px 0 8px', flexWrap: 'wrap', fontSize: 12 }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 3, background: '#26344b', marginRight: 6, verticalAlign: 'middle' }} />Total {usd0(last.value)}</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 3, background: '#b9b3a8', marginRight: 6, verticalAlign: 'middle' }} />You paid in {usd0(last.paid)}</span>
        <span style={{ color: '#237804' }}>Earned {usd0(last.value - last.paid)}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img"
           aria-label={`Portfolio value from ${pts[0].period} to ${last.period}`}>
        <path d={area} fill="#237804" opacity="0.12" />
        <path d={line((p) => p.paid)} fill="none" stroke="#b9b3a8" strokeWidth="2" />
        <path d={line((p) => p.value)} fill="none" stroke="#26344b" strokeWidth="2.5" />
        {years.map((yr) => {
          const i = pts.findIndex((p) => p.period.startsWith(yr));
          return (
            <text key={yr} x={x(i)} y={h - 4} fontSize="11" fill="#726c63" textAnchor={i === 0 ? 'start' : 'middle'}>
              {yr}
            </text>
          );
        })}
      </svg>
    </>
  );

  // `bare` drops the Card frame for callers that already provide one.
  return bare ? <div>{inner}</div> : <Card styles={{ body: { padding: 12 } }}>{inner}</Card>;
}
