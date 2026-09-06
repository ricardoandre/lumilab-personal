'use client';

import { Row, Col, Card, Statistic, Grid } from 'antd';
import type { YearVsBench, StockYearRow } from '@/lib/gotrade/report';
import { StatCard, BreakdownLine, BreakdownNote, BreakdownStack } from './StatCard';
import { StockLabel } from './StockIcon';
import { usd, usd0, Pct, Money } from './money';

const GREEN = '#237804';
const RED = '#a8071a';

/**
 * The year at a glance, in the same clickable-card layout as the headline
 * figures above it — one visual language for "a number you can open".
 *
 * "New invested fund" earns its place: without it the year reads as a triumph.
 * Lisa's 2026 portfolio nearly doubled while the real return was +4.21%; the
 * rest was money she paid in.
 */
export function YearMetrics({
  year, cash, stocks,
}: { year: YearVsBench; cash: number; stocks: StockYearRow[] }) {
  const screens = Grid.useBreakpoint();
  const small = !screens.lg;
  const prev = Number(year.year) - 1;
  const pct = (v: number | null) => (v === null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`);

  const byYearReturn = [...stocks].sort((a, b) => (b.yearReturnPct ?? -Infinity) - (a.yearReturnPct ?? -Infinity));
  const byYearMoney = [...stocks].sort((a, b) => b.yearGain - a.yearGain);

  const plain = (title: string, value: string, color?: string) => (
    <Card size={small ? 'small' : 'default'}>
      <Statistic title={title} value={value} valueStyle={color ? { color } : undefined} />
    </Card>
  );

  return (
    <Row gutter={[12, 12]}>
      <Col xs={12} lg={8}>{plain(`End ${prev} value`, usd(year.startValue))}</Col>
      <Col xs={12} lg={8}>{plain('New invested fund', usd(year.contributions))}</Col>

      <Col xs={12} lg={8}>
        <StatCard small={small} title="Current portfolio value" value={usd(year.endValue)}
          drawerTitle={`What ${year.year} is made of`}
          breakdown={
            <BreakdownStack>
              {[...stocks].sort((a, b) => b.marketValue - a.marketValue).map((s) => (
                <BreakdownLine key={s.symbol} label={<StockLabel symbol={s.symbol} name={s.name} size={22} />}
                  value={<Money v={s.marketValue} />} />
              ))}
              <BreakdownLine label="Cash" value={<Money v={cash} />} divider />
              <BreakdownLine label="Total" value={<Money v={year.endValue} />} strong divider />
            </BreakdownStack>
          } />
      </Col>

      <Col xs={12} lg={8}>{plain('Remaining cash', usd(cash))}</Col>

      <Col xs={12} lg={8}>
        <StatCard small={small} title="Total return amount" value={usd0(year.gain)}
          valueColor={year.gain >= 0 ? GREEN : RED}
          drawerTitle={`What ${year.year} earned`}
          breakdown={
            <BreakdownStack>
              <BreakdownLine label="Dividends received" value={<Money v={year.income} zeroDim />} />
              <BreakdownLine label="Everything else is price movement" value={<Money v={year.gain - year.income} />} />
              <BreakdownLine label={`Earned in ${year.year}`} value={<Money v={year.gain} />} strong divider />
              <div style={{ marginTop: 20, marginBottom: 4, fontWeight: 600 }}>By stock — most earned first</div>
              {byYearMoney.map((s) => (
                <BreakdownLine key={s.symbol} label={<StockLabel symbol={s.symbol} name={s.name} size={22} />}
                  note={s.startValue === 0 ? 'bought this year' : undefined}
                  value={<Money v={s.yearGain} />} />
              ))}
            </BreakdownStack>
          } />
      </Col>

      <Col xs={12} lg={8}>
        <StatCard small={small} title={`Return ${year.year}`} value={pct(year.returnPct)}
          valueColor={(year.returnPct ?? 0) >= 0 ? GREEN : RED}
          drawerTitle={`${year.year} return`}
          breakdown={
            <BreakdownStack>
              <BreakdownLine label="You" value={<Pct v={year.returnPct} bold />} />
              <BreakdownLine label="SPY, same months" value={<Pct v={year.benchmarkPct} />} />
              <BreakdownLine label="Difference" value={<Pct v={year.vsBenchmark} />} divider />
              <div style={{ marginTop: 20, marginBottom: 4, fontWeight: 600 }}>By stock — best first</div>
              {byYearReturn.map((s) => (
                <BreakdownLine key={s.symbol} label={<StockLabel symbol={s.symbol} name={s.name} size={22} />}
                  note={s.netTraded > 0 ? `${usd(s.netTraded)} bought this year` : undefined}
                  value={<Pct v={s.yearReturnPct} />} />
              ))}
              <BreakdownNote>
                Buying more of a stock is not a gain, so money put in during the year is taken out of
                the return and added to the base it is measured against.
              </BreakdownNote>
            </BreakdownStack>
          } />
      </Col>
    </Row>
  );
}
