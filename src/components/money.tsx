'use client';

export const usd = (n: number) =>
  (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const usd0 = (n: number) =>
  (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });

export function Pct({ v, bold }: { v: number | null | undefined; bold?: boolean }) {
  if (v === null || v === undefined) return <span style={{ color: '#999' }}>—</span>;
  const pct = v * 100;
  return (
    <span style={{ color: pct >= 0 ? '#237804' : '#a8071a', fontWeight: bold ? 600 : undefined, fontVariantNumeric: 'tabular-nums' }}>
      {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
    </span>
  );
}

export function Money({ v, zeroDim }: { v: number; zeroDim?: boolean }) {
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', color: v < 0 ? '#a8071a' : zeroDim && v === 0 ? '#bbb' : undefined }}>
      {usd(v)}
    </span>
  );
}
