'use client';

import { Row, Col, Card, Statistic, Typography, Grid } from 'antd';
import type { Overview, StockRow } from '@/lib/gotrade/report';
import { StatCard, BreakdownLine, BreakdownNote, BreakdownStack } from './StatCard';
import { usd, usd0, Pct, Money } from './money';

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
  overview, stocks, clickable = true,
}: { overview: Overview; stocks: StockRow[]; clickable?: boolean }) {
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
                  {stocks.map((s) => (
                    <BreakdownLine key={s.symbol} label={s.symbol} note={s.name ?? undefined} value={<Money v={s.marketValue} />} />
                  ))}
                  <BreakdownLine label="Cash" note="uninvested" value={<Money v={overview.cash} />} divider />
                  <BreakdownLine label="Total" value={<Money v={overview.latestValue} />} strong divider />
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
                  <div style={{ marginTop: 20, marginBottom: 4, fontWeight: 600 }}>By stock</div>
                  {stocks.map((s) => (
                    <BreakdownLine key={s.symbol} label={s.symbol}
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
                  <div style={{ marginTop: 20, marginBottom: 4, fontWeight: 600 }}>By stock</div>
                  {stocks.map((s) => (
                    <BreakdownLine key={s.symbol} label={s.symbol} note={s.name ?? undefined} value={<Pct v={s.returnPct} />} />
                  ))}
                  <BreakdownNote>
                    This is what your money grew by — the same measure Gotrade&apos;s own app shows.
                    &quot;Return a year&quot; answers a different question: how the investments
                    performed regardless of when money arrived. Money paid in recently is fully
                    counted here but has had no time to grow, which is why the two differ.
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
                  <BreakdownLine label="Performance over the whole period" value={<Pct v={overview.sinceInception} />} divider />
                  <BreakdownNote>
                    Time-weighted: each month&apos;s performance chained together, so paying money in
                    is never counted as a gain. This is how a fund&apos;s return is quoted, and it is
                    the fair way to compare against SPY.
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
