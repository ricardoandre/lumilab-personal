import { pdfRows, num } from './pdf-rows.ts';

export interface IpotHolding {
  symbol: string;
  name: string | null;
  avgPrice: number;
  close: number;
  volume: number;
  costValue: number;
  marketValue: number;
  unrealized: number;
}

export interface IpotPortfolio {
  accountCode: string | null;
  asOf: string | null;
  holdings: IpotHolding[];
  /** "Net A/C" — the cash sitting in the account. */
  cash: number | null;
  totalMarketValue: number | null;
}

/**
 * IPOT's portfolio PDF is the equivalent of Gotrade's Holdings block, and the
 * ONLY thing that says what the shares are worth — the monthly statement is a
 * cash ledger and never mentions a price.
 */
export async function parseIpotPortfolio(data: Buffer): Promise<IpotPortfolio> {
  const rows = await pdfRows(data);
  const text = rows.map((r) => r.cells.join(' ')).join('\n');

  const accountCode = (text.match(/Client\s+(R\d{6,})/) || [])[1] ?? null;
  const asOfRaw = (text.match(/As of\s+\w+,\s*(\d{2}-[A-Za-z]{3}-\d{2})/) || [])[1] ?? null;
  const asOf = asOfRaw ? isoFromShort(asOfRaw) : null;
  const cash = (() => {
    const m = text.match(/Net A\/\s?C\s+([\d,]+)/);
    return m ? num(m[1]) : null;
  })();

  const holdings: IpotHolding[] = [];
  let totalMarketValue: number | null = null;

  for (const row of rows) {
    const cells = row.cells;
    if (/^Total$/i.test(cells[0] ?? '')) {
      const nums = cells.map(num).filter((n): n is number => n !== null);
      // Total row: lot, volume, stock value, market value, unrealised.
      if (nums.length >= 4) totalMarketValue = nums[nums.length - 2];
      continue;
    }

    // "1." then "BMRI-BANK MANDIRI ( PERSERO ) Tbk" then six figures.
    if (!/^\d+\.$/.test(cells[0] ?? '')) continue;
    const label = cells[1] ?? '';
    const m = label.match(/^([A-Z]{2,6})-(.*)$/);
    if (!m) continue;

    const nums = cells.slice(2).map(num).filter((n): n is number => n !== null);
    // avgPrice, close, lot, volume, stockValue, marketValue, unrealized
    if (nums.length < 7) continue;
    const [avgPrice, close, , volume, costValue, marketValue, unrealized] = nums;

    holdings.push({
      symbol: m[1],
      name: m[2].trim() || null,
      avgPrice, close, volume, costValue, marketValue, unrealized,
    });
  }

  return { accountCode, asOf, holdings, cash, totalMarketValue };
}

function isoFromShort(s: string): string | null {
  const m = s.match(/^(\d{2})-([A-Za-z]{3})-(\d{2})$/);
  if (!m) return null;
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const mm = months[m[2].toLowerCase()];
  return mm ? `20${m[3]}-${mm}-${m[1]}` : null;
}
