'use client';

import { Row, Col, Card, Statistic, Typography, Grid } from 'antd';
import type { Overview, StockRow, YearVsBench } from '@/lib/gotrade/report';
import { StatCard, BreakdownLine, BreakdownNote, BreakdownStack } from './StatCard';
import { usd, usd0, Pct, Money } from './money';
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
  overview, stocks, years, irr, clickable = true,
}: {
  overview: Overview; stocks: StockRow[];
  years?: YearVsBench[]; irr?: number | null;
  clickable?: boolean;
}) {
  // Breakdown lists are ordered by RETURN, best first — the ranking is the point
  // of opening them, and alphabetical order says nothing.
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
            <StatCard small={small} title="Total money invested" value={usd(overview.contributions)}
              drawerTitle="Money you put in"
              breakdown={
                <BreakdownStack>
                  <BreakdownLine label="Deposits and credits" value={<Money v={overview.contributions} />} strong />
                  <BreakdownLine label="Invested since" value={monthName(overview.investedSince) ?? '—'} />
                  <BreakdownLine label="Worth today" value={<Money v={overview.latestValue} />} divider />
                  <BreakdownLine label="Difference" value={<Money v={overview.gain} />} strong />
                  <BreakdownNote>
                    Gotrade&apos;s promotional credits count here as money paid in, not as return, so a
                    broker giveaway cannot flatter how your own capital performed.
                  </BreakdownNote>
                </BreakdownStack>
              } />
          ) : plain('Total money invested', usd(overview.contributions))}
        </Col>
        <Col xs={12} lg={6}>
          {clickable ? (
            <StatCard small={small} title="Portfolio value" value={usd(overview.latestValue)}
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
                  <BreakdownNote>
                    Share prices are those printed on your latest statement — the only price source
                    there is, since Gotrade has no API.
                  </BreakdownNote>
                </BreakdownStack>
              } />
          ) : plain('Portfolio value', usd(overview.latestValue))}
        </Col>

        <Col xs={12} lg={6}>{plain('Current cash', usd(overview.cash))}</Col>
        <Col xs={12} lg={6}>
          {clickable ? (
            <StatCard small={small} title="Investment earned" value={usd0(overview.gain)}
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
                      note={s.dividends ? `${usd(s.unrealized)} price + ${usd(s.dividends)} dividends` : 'price growth'}
                      value={<Money v={s.totalReturn} />} />
                  ))}
                </BreakdownStack>
              } />
          ) : plain('Investment earned', usd0(overview.gain), overview.gain >= 0 ? GREEN : RED)}
        </Col>

        <Col xs={12} lg={6}>
          {clickable ? (
            <StatCard small={small} title="Total return" value={pct(overview.simpleReturn)}
              valueColor={(overview.simpleReturn ?? 0) >= 0 ? GREEN : RED}
              drawerTitle="Total return"
              breakdown={
                <BreakdownStack>
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
                  <BreakdownNote>
                    <strong>How this is worked out:</strong> what you have now, minus what you put
                    in, divided by what you put in. Nothing more. It is the figure Gotrade&apos;s own
                    app shows.
                    <br /><br />
                    It has one blind spot: money paid in last month counts in full, even though it
                    has had no time to grow. So a portfolio you are actively adding to will always
                    look worse on this measure than it really is. &quot;Return a year&quot; is the
                    one that corrects for that.
                  </BreakdownNote>
                </BreakdownStack>
              } />
          ) : plain('Total return', pct(overview.simpleReturn), (overview.simpleReturn ?? 0) >= 0 ? GREEN : RED)}
        </Col>
        <Col xs={12} lg={6}>
          {clickable ? (
            <StatCard small={small} title="Return a year" value={pct(overview.annualised)}
              valueColor={(overview.annualised ?? 0) >= 0 ? GREEN : RED}
              drawerTitle="Return a year"
              breakdown={
                <BreakdownStack>
                  <BreakdownLine label="You" value={<Pct v={overview.annualised} bold />} />
                  <BreakdownLine label="SPY, same months" value={<Pct v={overview.benchAnnualised} />} />
                  {irr !== undefined && irr !== null && (
                    <BreakdownLine label="Your own money's rate (IRR)" note="what your actual deposits earned"
                      value={<Pct v={irr} />} />
                  )}
                  {overview.dividendYield !== null && (
                    <BreakdownLine label="Dividend yield" note={`${usd(overview.dividends12m)} received in the last 12 months`}
                      value={<Pct v={overview.dividendYield} />} />
                  )}
                  <BreakdownLine label="Whole period" value={<Pct v={overview.sinceInception} />} divider />

                  {years && years.length > 0 && (
                    <>
                      <div style={{ marginTop: 20, marginBottom: 4, fontWeight: 600 }}>Year by year</div>
                      {[...years].reverse().map((y) => (
                        <BreakdownLine key={y.year} label={y.year}
                          note={`SPY ${y.benchmarkPct === null ? '—' : `${(y.benchmarkPct * 100).toFixed(2)}%`}`}
                          value={<Pct v={y.returnPct} />} />
                      ))}
                    </>
                  )}

                  <BreakdownNote>
                    <strong>Return a year</strong> measures the investments, not your timing. Each
                    month is scored on its own — how much the pot moved, ignoring anything you paid
                    in that month — and the months are then multiplied together. Because deposits
                    are stripped out, this is the only figure that can fairly be set beside SPY,
                    which has no deposits at all.
                    <br /><br />
                    <strong>IRR</strong> asks the opposite question: what rate did <em>your</em>
                    money earn? Picture every deposit you made growing at one steady rate; IRR is
                    the rate that would land you exactly on today&apos;s balance. So it rewards good
                    timing and punishes bad. Higher than &quot;return a year&quot; means your money
                    happened to go in at good moments; lower means it went in at poor ones.
                    <br /><br />
                    <strong>Dividend yield</strong> is the cash paid out to you over the last twelve
                    months, after tax, against what the portfolio is worth today.
                  </BreakdownNote>
                </BreakdownStack>
              } />
          ) : plain('Return a year', pct(overview.annualised), (overview.annualised ?? 0) >= 0 ? GREEN : RED)}
        </Col>
      </Row>
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
        Invested since {monthName(overview.investedSince) ?? '—'} · figures as at {monthName(overview.lastPeriod) ?? '—'}
      </Typography.Text>
    </>
  );
}
