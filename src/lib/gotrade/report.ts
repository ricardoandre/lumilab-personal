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
  income: number;            // dividends net of tax, plus broker rewards
  dividends: number;         // gross dividends
  tax: number;               // withholding, negative
  rewards: number;           // broker promotional credits
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
  /** First purchase — the start of the holding period. */
  heldSince: string | null;
  heldYears: number | null;
  /** Total return spread over the holding period, so a 3-month and a 4-year
   *  position can be compared at all. Null under ~3 months: annualising a few
   *  weeks produces confident nonsense. */
  annualisedPct: number | null;
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
    // JOURNAL is NOT a contribution. Those rows are Gotrade's own promotional
    // credits — "Campaign reward Highvaluedeposit July $80.00" — money the
    // broker gave, not money Andre paid in. Counting them as contributions
    // claimed he had funded $84 he never funded, and suppressed the return his
    // actual capital earned. They belong with income.
    const flows = inMonth.filter((t: any) => ['DEPOSIT', 'WITHDRAWAL'].includes(t.type));
    const contributions = r2(flows.reduce((a: number, t: any) => a + num(t.netAmount), 0));
    const income = r2(
      inMonth.filter((t: any) => ['DIVIDEND', 'INTEREST', 'TAX', 'JOURNAL'].includes(t.type))
        .reduce((a: number, t: any) => a + num(t.netAmount), 0),
    );
    const sumOf = (types: string[]) =>
      r2(inMonth.filter((t: any) => types.includes(t.type)).reduce((a: number, t: any) => a + num(t.netAmount), 0));
    const dividends = sumOf(['DIVIDEND']);
    const tax = sumOf(['TAX']);
    const rewards = sumOf(['JOURNAL']);
    const fees = sumOf(['FEE']);

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

    rows.push({ period, periodEnd: end.toISOString().slice(0, 10), cash, holdingsValue, portfolioValue, contributions, income, dividends, tax, rewards, fees, gain, returnPct });
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

  // First BUY per security = when the holding period started.
  const firstBuys = await db.transaction.groupBy({
    by: ['securityId'],
    where: { accountId, type: 'BUY' },
    _min: { tradeDate: true },
  });
  const firstBySec = new Map<string, Date>(
    firstBuys.filter((f: any) => f.securityId && f._min.tradeDate)
      .map((f: any) => [String(f.securityId), f._min.tradeDate as Date]),
  );
  const asOf: Date = latest.periodEnd;

  return latest.holdings.map((h: any) => {
    const costBasis = num(h.costBasis);
    const marketValue = num(h.marketValue);
    const unrealized = num(h.unrealized);
    const dividends = r2(divBySec.get(String(h.securityId)) ?? 0);
    const totalReturn = r2(unrealized + dividends);
    const first = firstBySec.get(String(h.securityId)) ?? null;
    const years = first ? (asOf.getTime() - first.getTime()) / (365.25 * 24 * 3600 * 1000) : null;
    const simple = costBasis > 0 ? r4(totalReturn / costBasis) : null;
    return {
      symbol: h.security.symbol,
      name: h.security.name,
      quantity: Number(h.quantity),
      costBasis, marketValue, unrealized, dividends, totalReturn,
      returnPct: simple,
      heldSince: first ? first.toISOString().slice(0, 10) : null,
      heldYears: years === null ? null : r2(years),
      annualisedPct:
        simple !== null && years !== null && years >= 0.25
          ? r4(Math.pow(1 + simple, 1 / years) - 1)
          : null,
    };
  }).sort((a: StockRow, b: StockRow) => b.marketValue - a.marketValue);
}

// ─────────────────────────── benchmark & annualisation ───────────────────────

export interface BenchRow {
  period: string;
  portfolioPct: number | null;
  benchmarkPct: number | null;
}

export interface YearVsBench extends YearRow {
  benchmarkPct: number | null;
  vsBenchmark: number | null;
}

/**
 * SPY TOTAL return, month by month, from data already in the statements.
 *
 * Total, not price-only, and the distinction is not cosmetic: SPY yields ~1.3%
 * a year, so comparing the portfolio's total return against SPY's price return
 * would flatter the portfolio by roughly that much every year, compounding.
 *
 * The dividend per share comes from the statement text itself — Alpaca prints
 * "Cash DIV @ 1.906073, Pos QTY: 14" — so no external price feed is needed,
 * which matters because this broker has no API.
 */
export async function benchmarkMonthly(db: Db, accountId: bigint, symbol = 'SPY'): Promise<Map<string, number>> {
  const sec = await db.security.findFirst({ where: { symbol } });
  if (!sec) return new Map();

  const holdings = await db.statementHolding.findMany({
    where: { securityId: sec.id, import: { accountId, status: 'ok' } },
    orderBy: { asOf: 'asc' },
    select: { asOf: true, marketPrice: true },
  });

  const divTx = await db.transaction.findMany({
    where: { accountId, securityId: sec.id, type: 'DIVIDEND' },
    select: { tradeDate: true, description: true },
  });
  const divPerShare = new Map<string, number>();
  for (const t of divTx) {
    const m = String(t.description ?? '').match(/Cash DIV @ ([\d.]+)/);
    if (!m) continue;
    const key = t.tradeDate.toISOString().slice(0, 7);
    divPerShare.set(key, (divPerShare.get(key) ?? 0) + parseFloat(m[1]));
  }

  const out = new Map<string, number>();
  let prev: number | null = null;
  for (const h of holdings) {
    const period = h.asOf.toISOString().slice(0, 7);
    const price = num(h.marketPrice);
    if (price <= 0) { prev = prev; continue; }
    if (prev !== null && prev > 0) {
      out.set(period, r4((price + (divPerShare.get(period) ?? 0) - prev) / prev));
    }
    prev = price;
  }
  return out;
}

/** Chain monthly returns, then express per year. n months of r -> (1+r)^(12/n) - 1. */
export function annualise(monthlyReturns: (number | null)[]): number | null {
  const rs = monthlyReturns.filter((r): r is number => r !== null);
  if (!rs.length) return null;
  const total = rs.reduce((acc, r) => acc * (1 + r), 1);
  return r4(Math.pow(total, 12 / rs.length) - 1);
}

export function chain(monthlyReturns: (number | null)[]): number | null {
  const rs = monthlyReturns.filter((r): r is number => r !== null);
  if (!rs.length) return null;
  return r4(rs.reduce((acc, r) => acc * (1 + r), 1) - 1);
}

/**
 * Yearly table with the benchmark beside it.
 *
 * A part-year is annualised so the column means the same thing in every row:
 * 2021 covers nine months, and printing its raw nine-month figure next to four
 * full years invites exactly the wrong comparison.
 */
export function yearlyVsBenchmark(months: MonthRow[], bench: Map<string, number>): YearVsBench[] {
  const years = yearlyFromMonths(months);
  return years.map((y) => {
    const ms = months.filter((m) => m.period.startsWith(y.year));
    const b = chain(ms.map((m) => bench.get(m.period) ?? null));
    return {
      ...y,
      benchmarkPct: b,
      vsBenchmark: y.returnPct !== null && b !== null ? r4(y.returnPct - b) : null,
    };
  });
}

export interface Overview {
  latestValue: number;
  cash: number;
  holdingsValue: number;
  cashPct: number;
  contributions: number;
  income: number;
  dividends: number;
  tax: number;
  rewards: number;
  /** Everything earned that is not income — i.e. the holdings going up. */
  priceGrowth: number;
  gain: number;
  sinceInception: number | null;
  annualised: number | null;
  benchAnnualised: number | null;
  months: number;
  firstPeriod: string | null;
  lastPeriod: string | null;
  /** What the idle cash cost, valued at the benchmark's return over the same months. */
  cashDragUsd: number | null;
}

export function overviewFrom(months: MonthRow[], bench: Map<string, number>): Overview | null {
  if (!months.length) return null;
  const latest = months[months.length - 1];
  const rs = months.map((m) => m.returnPct);
  const bs = months.map((m) => bench.get(m.period) ?? null);

  // Cash drag: idle cash each month, valued at what the benchmark returned that
  // month. Deliberately a MEASURE, not advice — a buffer can be worth its cost.
  let drag = 0;
  let dragKnown = false;
  for (const m of months) {
    const b = bench.get(m.period);
    if (b === undefined) continue;
    drag += m.cash * b;
    dragKnown = true;
  }

  const income = r2(months.reduce((a, m) => a + m.income, 0));
  const gain = r2(months.reduce((a, m) => a + m.gain, 0));

  return {
    latestValue: latest.portfolioValue,
    cash: latest.cash,
    holdingsValue: latest.holdingsValue,
    cashPct: latest.portfolioValue > 0 ? r4(latest.cash / latest.portfolioValue) : 0,
    contributions: r2(months.reduce((a, m) => a + m.contributions, 0)),
    income,
    dividends: r2(months.reduce((a, m) => a + m.dividends, 0)),
    tax: r2(months.reduce((a, m) => a + m.tax, 0)),
    rewards: r2(months.reduce((a, m) => a + m.rewards, 0)),
    priceGrowth: r2(gain - income),
    gain,
    sinceInception: chain(rs),
    annualised: annualise(rs),
    benchAnnualised: annualise(bs),
    months: months.length,
    firstPeriod: months[0].period,
    lastPeriod: latest.period,
    cashDragUsd: dragKnown ? r2(drag) : null,
  };
}
