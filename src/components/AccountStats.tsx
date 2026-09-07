'use client';

import { Row, Col, Card, Statistic, Typography, Grid } from 'antd';
import type { Overview, StockRow, YearVsBench, YearIrr } from '@/lib/gotrade/report';
import { StatCard, BreakdownLine, BreakdownNote, BreakdownStack } from './StatCard';
import { usd, usd0, Pct, Money, useCurrency, formatMoney } from './money';
import { StockLabel } from './StockIcon';

const GREEN = '#237804';
const RED = '#a8071a';

const monthName = (period: string | null) => {
  if (!period) return null;
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

/**
 * The six headline figures, shared by the dashboard and the overview report so
 * the two can never drift apart.
 *
 * Two different returns are shown deliberately, because they answer different
 * questions and Gotrade's own app shows the first:
 *   Total return  = (value - money in) / money in
 *   Return a year = time-weighted, annualised
 * On an account funded steadily these diverge a lot — recent contributions are
 * fully counted in the denominator of the first while having had no time to grow.
 */
export function AccountStats({
  overview, stocks, years, irr, irrYears, clickable = true,
}: {
  overview: Overview; stocks: StockRow[];
  years?: YearVsBench[]; irr?: number | null; irrYears?: YearIrr[];
  clickable?: boolean;
}) {
  // Format in the SCREEN's currency, not always dollars — an IPOT account is
  // in rupiah and read "$840,970,000".
  const currency = useCurrency();
  const money = (n: number) => formatMoney(n, currency);
  const money0 = (n: number) => formatMoney(n, currency, { compact: true });

  // Breakdown lists are ordered by RETURN, best first — the ranking is the point
  // of opening them, and alphabetical order says nothing.
  /**
   * A time-weighted return needs a valuation every month. IPOT's statements
   * carry no prices, so months between portfolio exports hold the last known
   * one — chaining those produces a confident figure with nothing behind it
   * (-6.44% a year on an account that has roughly tripled). Suppressed rather
   * than shown, with IRR left as the honest annual rate.
   */
  const annualisedTrustworthy = overview.holdingsStaleMonths < 2;

  const byReturn = [...stocks].sort((a, b) => (b.returnPct ?? -Infinity) - (a.returnPct ?? -Infinity));
  const byMoney = [...stocks].sort((a, b) => b.totalReturn - a.totalReturn);
  const screens = Grid.useBreakpoint();
  const small = !screens.lg;
  const pct = (v: number | null) => (v === null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`);

  const plain = (title: string, value: string, color?: string) => (
    <Card size={small ? 'small' : 'default'}><Statistic title={title} value={value} valueStyle={color ? { color } : undefined} /></Card>
  );

  return (
    <>
      <Row gutter={[12, 12]}>
        <Col xs={12} lg={6}>
          {clickable ? (
            <StatCard small={small} title="Total money invested" value={money(overview.contributions)}
              drawerTitle="Money you put in"
              breakdown={
                <BreakdownStack>
                  {years && years.length > 0 && (
                    <>
                      <div style={{ marginTop: 16, marginBottom: 4, fontWeight: 600 }}>Paid in, year by year</div>
                      {[...years].reverse().map((y) => (
                        <BreakdownLine key={y.year} label={y.year} value={<Money v={y.contributions} zeroDim />} />
                      ))}
                    </>
                  )}
                  <BreakdownLine label="Total paid in" value={<Money v={overview.contributions} />} strong divider />
                  <BreakdownLine label="Worth today" value={<Money v={overview.latestValue} />} />
                  <BreakdownLine label="Difference" value={<Money v={overview.gain} />} strong />
                </BreakdownStack>
              } />
          ) : plain('Total money invested', money(overview.contributions))}
        </Col>
        <Col xs={12} lg={6}>
          {clickable ? (
            <StatCard small={small} title="Portfolio value" value={money(overview.latestValue)}
              drawerTitle="What makes up the value"
              breakdown={
                <BreakdownStack>
                  {[...stocks].sort((a, b) => b.marketValue - a.marketValue).map((s) => (
                    <BreakdownLine key={s.symbol}
                      label={<StockLabel symbol={s.symbol} name={s.name} size={22} />}
                      note={`${(s.weightPct * 100).toFixed(1)}% of the account`}
                      value={<Money v={s.marketValue} />} />
                  ))}
                  <BreakdownLine label="Cash" note="uninvested" value={<Money v={overview.cash} />} divider />
                  <BreakdownLine label="Total" value={<Money v={overview.latestValue} />} strong divider />
                  {overview.topSymbol && overview.topWeightPct !== null && overview.topWeightPct > 0.3 && (
                    <BreakdownNote>
                      <strong>{overview.topSymbol} is {(overview.topWeightPct * 100).toFixed(0)}% of this
                      account.</strong> Not a mistake in itself — but it means your result depends
                      more on that one holding than on everything else combined.
                    </BreakdownNote>
                  )}
                </BreakdownStack>
              } />
          ) : plain('Portfolio value', money(overview.latestValue))}
        </Col>

        <Col xs={12} lg={6}>{plain('Current cash', money(overview.cash))}</Col>
        <Col xs={12} lg={6}>
          {clickable ? (
            <StatCard small={small} title="Investment earned" value={money0(overview.gain)}
              valueColor={overview.gain >= 0 ? GREEN : RED}
              drawerTitle="Where the money came from"
              breakdown={
                <BreakdownStack>
                  <BreakdownLine label="Share price growth" value={<Money v={overview.priceGrowth} />} />
                  <BreakdownLine label="Dividends received" value={<Money v={overview.dividends} />} />
                  <BreakdownLine label="Withholding tax" note="15% US tax on dividends" value={<Money v={overview.tax} />} />
                  <BreakdownLine label="Total earned" value={<Money v={overview.gain} />} strong divider />
                  <div style={{ marginTop: 20, marginBottom: 4, fontWeight: 600 }}>By stock — most earned first</div>
                  {byMoney.map((s) => (
                    <BreakdownLine key={s.symbol}
                      label={<StockLabel symbol={s.symbol} name={s.name} size={22} />}
                      note={s.dividends ? `${money(s.unrealized)} price + ${money(s.dividends)} dividends` : 'price growth'}
                      value={<Money v={s.totalReturn} />} />
                  ))}
                </BreakdownStack>
              } />
          ) : plain('Investment earned', money0(overview.gain), overview.gain >= 0 ? GREEN : RED)}
        </Col>

        <Col xs={12} lg={6}>
          {clickable ? (
            <StatCard small={small} title="Total return" value={pct(overview.simpleReturn)}
              valueColor={(overview.simpleReturn ?? 0) >= 0 ? GREEN : RED}
              drawerTitle="Total return"
              breakdown={
                <BreakdownStack>
                  <BreakdownNote>
                    What your money grew by: everything it is worth now, against everything you put in.
                    <Formula>(Portfolio value − Money invested) ÷ Money invested</Formula>
                  </BreakdownNote>
                  <div style={{ marginTop: 16 }} />
                  <BreakdownLine label="Money in" value={<Money v={overview.contributions} />} />
                  <BreakdownLine label="Worth today" value={<Money v={overview.latestValue} />} />
                  <BreakdownLine label="Earned" value={<Money v={overview.gain} />} strong divider />
                  <BreakdownLine label="Total return" value={<Pct v={overview.simpleReturn} bold />} strong />
                  <div style={{ marginTop: 20, marginBottom: 4, fontWeight: 600 }}>By stock — best first</div>
                  {byReturn.map((s) => (
                    <BreakdownLine key={s.symbol}
                      label={<StockLabel symbol={s.symbol} name={s.name} size={22} />}
                      value={<Pct v={s.returnPct} />} />
                  ))}

                </BreakdownStack>
              } />
          ) : plain('Total return', pct(overview.simpleReturn), (overview.simpleReturn ?? 0) >= 0 ? GREEN : RED)}
        </Col>
        <Col xs={12} lg={6}>
          {clickable ? (
            <StatCard small={small} title="Return a year"
              value={annualisedTrustworthy ? pct(overview.annualised) : '—'}
              valueColor={annualisedTrustworthy && (overview.annualised ?? 0) >= 0 ? GREEN : RED}
              drawerTitle="Return a year"
              breakdown={
                <BreakdownStack>
                  {!annualisedTrustworthy && (
                    <BreakdownNote>
                      <strong>Not shown for this account.</strong> A yearly return needs a valuation
                      every month, and this broker&apos;s statements carry no share prices — the
                      months between holdings reports hold the last known price. Chaining those
                      produces a confident figure with nothing behind it. Today&apos;s value IS
                      live-priced; only the month-by-month history is not. Use IRR instead.
                    </BreakdownNote>
                  )}
                  <BreakdownNote>
                    How the investments themselves performed each year on average, with your deposits
                    stripped out so paying money in never looks like a gain.
                    <Formula>{`Each month:  (End − Start − Paid in) ÷ (Start + Paid in × days invested)
Then:        multiply every month together, and annualise`}</Formula>
                  </BreakdownNote>
                  <div style={{ marginTop: 16 }} />
                  <BreakdownLine label="You" value={<Pct v={overview.annualised} bold />} />
                  <BreakdownLine label="SPY over the same period" value={<Pct v={overview.benchAnnualised} />} />
                  <BreakdownLine label="Whole period" value={<Pct v={overview.sinceInception} />} divider />

                  {years && years.length > 0 && (
                    <>
                      <div style={{ marginTop: 20, marginBottom: 4, fontWeight: 600 }}>Year by year</div>
                      {[...years].reverse().map((y) => (
                        <BreakdownLine key={y.year} label={y.year}
                          note={
                            y.benchmarkPct === null
                              ? undefined
                              : `SPY ${(y.benchmarkPct * 100).toFixed(2)}% · you ${
                                  y.vsBenchmark === null
                                    ? ''
                                    : `${y.vsBenchmark >= 0 ? '+' : ''}${(y.vsBenchmark * 100).toFixed(2)}% vs SPY`
                                }`
                          }
                          value={<Pct v={y.returnPct} />} />
                      ))}
                    </>
                  )}


                </BreakdownStack>
              } />
          ) : plain('Return a year', pct(overview.annualised), (overview.annualised ?? 0) >= 0 ? GREEN : RED)}
        </Col>
        <Col xs={12} lg={6}>
          {clickable ? (
            <StatCard small={small} title="Your money's rate (IRR)" value={pct(irr ?? null)}
              valueColor={(irr ?? 0) >= 0 ? GREEN : RED}
              drawerTitle="IRR — what your own deposits earned"
              breakdown={
                <BreakdownStack>
                  <BreakdownNote>
                    The one steady rate that would turn your actual deposits, on the dates you made
                    them, into today&apos;s balance — so unlike the others, it rewards good timing.
                    <Formula>{`Find the rate r where:
Σ  each deposit ÷ (1 + r) ^ years since that deposit  =  Portfolio value today`}</Formula>
                  </BreakdownNote>
                  <div style={{ marginTop: 16 }} />
                  <BreakdownLine label="Your money's rate (IRR)" value={<Pct v={irr ?? null} bold />} />
                  <BreakdownLine label="Annualised return" value={<Pct v={overview.annualised} />} />
                  <BreakdownLine label="SPY over the same period" value={<Pct v={overview.benchAnnualised} />} divider />
                  {irrYears && irrYears.length > 0 && (
                    <>
                      <div style={{ marginTop: 20, marginBottom: 4, fontWeight: 600 }}>Year by year</div>
                      {[...irrYears].reverse().map((y) => (
                        <BreakdownLine key={y.year} label={y.year}
                          note={y.contributions !== 0 ? `${money(y.contributions)} paid in` : 'nothing paid in'}
                          value={<Pct v={y.irr} />} />
                      ))}
                    </>
                  )}
                  <BreakdownNote>
                    Picture every deposit you made growing at one steady rate. IRR is the rate that
                    would land you exactly on today&apos;s balance — so it rewards good timing and
                    punishes bad.
                    <br /><br />
                    {irr !== undefined && irr !== null && overview.annualised !== null && (
                      irr > overview.annualised
                        ? 'Yours is HIGHER than the investments\u2019 own rate, which means your money tended to go in at good moments.'
                        : 'Yours is LOWER than the investments\u2019 own rate, which means your money tended to go in at less good moments.'
                    )}
                  </BreakdownNote>
                </BreakdownStack>
              } />
          ) : plain("Your money's rate (IRR)", pct(irr ?? null), (irr ?? 0) >= 0 ? GREEN : RED)}
        </Col>
        <Col xs={12} lg={6}>
          {clickable ? (
            <StatCard small={small} title="Dividend yield" value={pct(overview.dividendYield)}
              drawerTitle="Dividend yield"
              breakdown={
                <BreakdownStack>
                  <BreakdownLine label="Received in the last 12 months" note="after 15% US withholding tax"
                    value={<Money v={overview.dividends12m} />} />
                  <BreakdownLine label="Portfolio value" value={<Money v={overview.latestValue} />} />
                  <BreakdownLine label="Yield" value={<Pct v={overview.dividendYield} bold />} strong divider />
                  <div style={{ marginTop: 20, marginBottom: 4, fontWeight: 600 }}>By stock — highest yield first</div>
                  {[...stocks].sort((a, b) => (b.dividendYield ?? -1) - (a.dividendYield ?? -1)).map((s) => (
                    <BreakdownLine key={s.symbol} label={<StockLabel symbol={s.symbol} name={s.name} size={22} />}
                      note={s.dividendYield === null ? 'pays no dividend' : undefined}
                      value={<Pct v={s.dividendYield} />} />
                  ))}
                  <BreakdownNote>
                    A run-rate: the cash actually paid out over the last twelve months against what
                    the portfolio is worth today. A lifetime total would understate a portfolio still
                    being built.
                  </BreakdownNote>
                </BreakdownStack>
              } />
          ) : plain('Dividend yield', pct(overview.dividendYield))}
        </Col>
      </Row>
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
        Invested since {monthName(overview.investedSince) ?? '—'} · figures as at {monthName(overview.lastPeriod) ?? '—'}
      </Typography.Text>
    </>
  );
}

/** A formula, set apart from the sentence above it. */
function Formula({ children }: { children: React.ReactNode }) {
  return (
    <pre style={{
      margin: '8px 0 0', padding: '8px 10px', background: '#f5f3ee', borderRadius: 6,
      fontSize: 11.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: '#3f3a33',
    }}>{children}</pre>
  );
}
