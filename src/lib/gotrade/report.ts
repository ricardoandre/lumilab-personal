type Db = any;

const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const num = (v: unknown) => (v == null ? 0 : Number(v));

export interface MonthRow {
  period: string;            // "2024-12"
  periodEnd: string;
  cash: number;
  holdingsValue: number;
  portfolioValue: number;
  contributions: number;     // deposits - withdrawals (external money only)
  income: number;            // dividends net of withholding tax
  fees: number;
  gain: number;              // value change that is NOT explained by contributions
  returnPct: number | null;  // Modified Dietz, day-weighted
}

export interface YearRow {
  year: string;
  startValue: number;
  endValue: number;
  contributions: number;
  income: number;
  gain: number;
  returnPct: number | null;  // months chained (time-weighted)
}

export interface StockRow {
  symbol: string;
  name: string | null;
  quantity: number;
  costBasis: number;
  marketValue: number;
  unrealized: number;
  dividends: number;
  totalReturn: number;
  returnPct: number | null;
}

/**
 * Monthly series for one account.
 *
 * Return is Modified Dietz, not the naive (end - start) / start. With money
 * being paid in, a rising balance mostly measures DEPOSITS, not performance —
 * this account took in $9,152 over four years, so the naive figure would be
 * meaningless. Each contribution is weighted by the fraction of the month it was
 * actually invested, which the exact transaction dates make possible.
 *
 * Dividends and trades are NOT contributions: they are money moving inside the
 * account, and counting them as inflows would suppress the very return we are
 * trying to measure. Only DEPOSIT/WITHDRAWAL/JOURNAL cross the boundary.
 */
export async function monthlySeries(db: Db, accountId: bigint): Promise<MonthRow[]> {
  const imports = await db.statementImport.findMany({
    where: { accountId, status: 'ok', periodEnd: { not: null } },
    orderBy: { periodEnd: 'asc' },
    include: { holdings: true },
  });

  const txs = await db.transaction.findMany({
    where: { accountId },
    orderBy: { tradeDate: 'asc' },
    select: { tradeDate: true, type: true, netAmount: true },
  });

  const rows: MonthRow[] = [];
  let prevValue: number | null = null;

  for (const imp of imports) {
    const end: Date = imp.periodEnd;
    const period = end.toISOString().slice(0, 7);
    const monthStart = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    const days = end.getUTCDate();

    const cash = num(imp.endingBalance);
    const holdingsValue = r2(imp.holdings.reduce((a: number, h: any) => a + num(h.marketValue), 0));
    const portfolioValue = r2(cash + holdingsValue);

    const inMonth = txs.filter((t: any) => t.tradeDate >= monthStart && t.tradeDate <= end);
    const flows = inMonth.filter((t: any) => ['DEPOSIT', 'WITHDRAWAL', 'JOURNAL'].includes(t.type));
    const contributions = r2(flows.reduce((a: number, t: any) => a + num(t.netAmount), 0));
    const income = r2(
      inMonth.filter((t: any) => ['DIVIDEND', 'INTEREST', 'TAX'].includes(t.type))
        .reduce((a: number, t: any) => a + num(t.netAmount), 0),
    );
    const fees = r2(inMonth.filter((t: any) => t.type === 'FEE').reduce((a: number, t: any) => a + num(t.netAmount), 0));

    const start = prevValue;
    const gain = start === null ? 0 : r2(portfolioValue - start - contributions);

    // Modified Dietz: each flow weighted by the share of the month it was invested.
    let returnPct: number | null = null;
    if (start !== null && (start > 0 || contributions !== 0)) {
      const weighted = flows.reduce((a: number, t: any) => {
        const day = t.tradeDate.getUTCDate();
        return a + num(t.netAmount) * ((days - day) / days);
      }, 0);
      const denom = start + weighted;
      if (Math.abs(denom) > 0.01) returnPct = r4((portfolioValue - start - contributions) / denom);
    }

    rows.push({ period, periodEnd: end.toISOString().slice(0, 10), cash, holdingsValue, portfolioValue, contributions, income, fees, gain, returnPct });
    prevValue = portfolioValue;
  }
  return rows;
}

/** Yearly rollup. Returns are CHAINED from the monthly ones, never recomputed
 *  from year-start to year-end — that would ignore mid-year contributions. */
export function yearlyFromMonths(months: MonthRow[]): YearRow[] {
  const byYear = new Map<string, MonthRow[]>();
  for (const m of months) {
    const y = m.period.slice(0, 4);
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(m);
  }
  const out: YearRow[] = [];
  for (const [year, ms] of [...byYear.entries()].sort()) {
    const idx = months.indexOf(ms[0]);
    const startValue = idx > 0 ? months[idx - 1].portfolioValue : 0;
    const endValue = ms[ms.length - 1].portfolioValue;
    const contributions = r2(ms.reduce((a, m) => a + m.contributions, 0));
    const income = r2(ms.reduce((a, m) => a + m.income, 0));
    const gain = r2(ms.reduce((a, m) => a + m.gain, 0));
    const withReturn = ms.filter((m) => m.returnPct !== null);
    const returnPct = withReturn.length
      ? r4(withReturn.reduce((acc, m) => acc * (1 + (m.returnPct as number)), 1) - 1)
      : null;
    out.push({ year, startValue, endValue, contributions, income, gain, returnPct });
  }
  return out;
}

/**
 * Per-stock position and return, as of the latest statement.
 *
 * Dividends are included in the return: a stock held for income looks like a
 * failure without them. PFE is the case in point here — flat on price, paying
 * out steadily.
 */
export async function stockReport(db: Db, accountId: bigint): Promise<StockRow[]> {
  const latest = await db.statementImport.findFirst({
    where: { accountId, status: 'ok', periodEnd: { not: null } },
    orderBy: { periodEnd: 'desc' },
    include: { holdings: { include: { security: true } } },
  });
  if (!latest) return [];

  const divs = await db.transaction.groupBy({
    by: ['securityId'],
    where: { accountId, type: { in: ['DIVIDEND', 'TAX'] } },
    _sum: { netAmount: true },
  });
  // Typed explicitly: the injected Prisma client is structurally typed, so
  // groupBy() returns `any` and Map infers its value as {}.
  const divBySec = new Map<string, number>(
    divs.map((d: any) => [String(d.securityId), num(d._sum.netAmount)]),
  );

  return latest.holdings.map((h: any) => {
    const costBasis = num(h.costBasis);
    const marketValue = num(h.marketValue);
    const unrealized = num(h.unrealized);
    const dividends = r2(divBySec.get(String(h.securityId)) ?? 0);
    const totalReturn = r2(unrealized + dividends);
    return {
      symbol: h.security.symbol,
      name: h.security.name,
      quantity: Number(h.quantity),
      costBasis, marketValue, unrealized, dividends, totalReturn,
      returnPct: costBasis > 0 ? r4(totalReturn / costBasis) : null,
    };
  }).sort((a: StockRow, b: StockRow) => b.marketValue - a.marketValue);
}
