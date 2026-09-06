'use client';

/**
 * A stable coloured monogram per ticker.
 *
 * Deliberately drawn locally rather than fetched from a logo service: the app
 * would otherwise make an outbound request per holding on every render, leak
 * which stocks are held to a third party, and show broken images the day that
 * service changes. The colour is derived from the symbol, so a given ticker is
 * always the same colour and the eye can find it without reading.
 */
const PALETTE = [
  '#26344b', '#2f6f5e', '#7a3b2e', '#4a3b7a', '#7a6a2e',
  '#2e5f7a', '#6b2e5f', '#3f6b2e', '#7a4a2e', '#2e4a6b',
];

function colourFor(symbol: string): string {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function StockIcon({ symbol, size = 26 }: { symbol: string; size?: number }) {
  // BRK.B -> BR, SPY -> SP: two letters read faster than five at this size.
  const initials = symbol.replace(/[^A-Z]/g, '').slice(0, 2);
  return (
    <span
      aria-hidden
      style={{
        width: size, height: size, borderRadius: size / 4, background: colourFor(symbol),
        color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.42, fontWeight: 700, letterSpacing: '-0.02em', flexShrink: 0,
      }}
    >
      {initials}
    </span>
  );
}

/** Icon plus ticker, the standard way a holding is named across the app. */
export function StockLabel({ symbol, name, size }: { symbol: string; name?: string | null; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <StockIcon symbol={symbol} size={size} />
      <span style={{ minWidth: 0 }}>
        <span style={{ fontWeight: 600 }}>{symbol}</span>
        {name && (
          <span style={{ display: 'block', fontSize: 11, color: '#726c63', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </span>
        )}
      </span>
    </span>
  );
}
