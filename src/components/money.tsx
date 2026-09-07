'use client';

import { createContext, useContext } from 'react';

/**
 * The currency the surrounding screen is denominated in.
 *
 * Every money helper here formatted as dollars, which was invisible while every
 * account was in dollars and wrong the moment one was not: the IPOT screens
 * showed "$840,970,000" for Rp 840,970,000. A screen declares its currency once
 * and the shared components follow, rather than each one taking a prop that a
 * new screen can forget to pass.
 */
const CurrencyContext = createContext<string>('USD');

export const CurrencyProvider = CurrencyContext.Provider;
export const useCurrency = () => useContext(CurrencyContext);

export const usd = (n: number) =>
  (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const usd0 = (n: number) =>
  (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });

export const idr = (n: number) =>
  (n < 0 ? '-' : '') + 'Rp ' + Math.round(Math.abs(n)).toLocaleString('id-ID');

/** Compact rupiah — full digits wrap on a phone at these magnitudes. */
export const idrShort = (n: number) => {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e9) return `${sign}Rp ${(a / 1e9).toFixed(2)} M`;
  if (a >= 1e6) return `${sign}Rp ${(a / 1e6).toFixed(1)} jt`;
  return idr(n);
};

export function formatMoney(n: number, currency: string, opts?: { compact?: boolean }): string {
  if (currency === 'IDR') return opts?.compact ? idrShort(n) : idr(n);
  return opts?.compact ? usd0(n) : usd(n);
}

export function Pct({ v, bold }: { v: number | null | undefined; bold?: boolean }) {
  if (v === null || v === undefined) return <span style={{ color: '#999' }}>—</span>;
  const pct = v * 100;
  return (
    <span style={{ color: pct >= 0 ? '#237804' : '#a8071a', fontWeight: bold ? 600 : undefined, fontVariantNumeric: 'tabular-nums' }}>
      {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
    </span>
  );
}

/**
 * A money value in the screen's own currency.
 *
 * `compact` is the default in list cells because rupiah figures run to
 * "Rp 2.331.697.205" — seventeen characters that do not fit a phone column
 * beside a label.
 */
export function Money({ v, zeroDim, compact }: { v: number; zeroDim?: boolean; compact?: boolean }) {
  const currency = useCurrency();
  return (
    <span style={{
      fontVariantNumeric: 'tabular-nums',
      color: v < 0 ? '#a8071a' : zeroDim && v === 0 ? '#bbb' : undefined,
      whiteSpace: 'nowrap',
    }}>
      {formatMoney(v, currency, { compact })}
    </span>
  );
}
