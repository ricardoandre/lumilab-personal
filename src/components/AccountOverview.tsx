'use client';

import { useState } from 'react';
import { Card, Typography, Space, Row, Col, Tag, Alert, Grid, Button, Statistic } from 'antd';
import type { MonthRow, YearVsBench, Overview, StockRow } from '@/lib/gotrade/report';
import { ResponsiveRows } from './ResponsiveRows';
import { PortfolioChart } from './PortfolioChart';
import { usd, usd0, Pct, Money } from './money';

const YEARS_SHOWN = 3;
const GREEN = '#237804';
const RED = '#a8071a';

/**
 * The Overview tab of the Report.
 *
 * No account header or upload button: the Report page supplies both, and the
 * clickable stat breakdowns live on the Dashboard. This is the long-form read.
 */
export function AccountOverview({
  overview, years, months, stocks,
}: {
  overview: Overview | null; years: YearVsBench[]; months: MonthRow[]; stocks: StockRow[];
}) {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;
  const size = isMobile ? ('small' as const) : ('default' as const);
  const [showAllYears, setShowAllYears] = useState(false);

  if (!overview) {
    return <Alert type="info" showIcon message="No statements yet"
      description="Upload your monthly statements and this fills itself in." />;
  }

  const orderedYears = [...years].reverse();
  const visibleYears = showAllYears ? orderedYears : orderedYears.slice(0, YEARS_SHOWN);
  const pct = (v: number | null) => (v === null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`);

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row gutter={[12, 12]}>
        <Col xs={12} lg={6}><Card size={size}>
          <Statistic title="Portfolio value" value={usd(overview.latestValue)} />
        </Card></Col>
        <Col xs={12} lg={6}><Card size={size}>
          <Statistic title="Total return" value={pct(overview.sinceInception)}
            valueStyle={{ color: (overview.sinceInception ?? 0) >= 0 ? GREEN : RED }} />
        </Card></Col>
        <Col xs={12} lg={6}><Card size={size}>
          <Statistic title="Return a year" value={pct(overview.annualised)}
            valueStyle={{ color: (overview.annualised ?? 0) >= 0 ? GREEN : RED }} />
        </Card></Col>
        <Col xs={12} lg={6}><Card size={size}>
          <Statistic title="Investment earned" value={usd0(overview.gain)}
            valueStyle={{ color: overview.gain >= 0 ? GREEN : RED }} />
        </Card></Col>
      </Row>

      <Card size={size}>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          Against just buying SPY: you <Pct v={overview.annualised} /> a year, SPY{' '}
          <Pct v={overview.benchAnnualised} /> a year.
        </Typography.Text>
      </Card>

      <Card size={size}>
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Typography.Text strong>Idle cash</Typography.Text>
          <div><Money v={overview.cash} /> uninvested — {(overview.cashPct * 100).toFixed(1)}% of the account.</div>
          {overview.cashDragUsd !== null && (
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              Had it tracked SPY it would have earned about <strong>{usd0(overview.cashDragUsd)}</strong> more.
              That is the price of the buffer, not an argument against it — the same cash is why{' '}
              {years.find((y) => (y.vsBenchmark ?? 0) > 0)?.year ?? 'a down year'} hurt less.
            </Typography.Text>
          )}
        </Space>
      </Card>

      <PortfolioChart months={months} />

      <Card title="Your stocks now" styles={{ body: { padding: 0 } }} size={size}>
        <ResponsiveRows<StockRow & { key: string }>
          rows={stocks.map((s) => ({ ...s, key: s.symbol }))}
          fields={[
            { key: 'sym', label: 'Symbol', primary: true, render: (r) => <Tag style={{ marginInlineEnd: 0 }}>{r.symbol}</Tag> },
            { key: 'val', label: 'Portfolio value', render: (r) => <Money v={r.marketValue} /> },
            { key: 'eq', label: 'Money in', render: (r) => <Money v={r.costBasis} /> },
            { key: 'ret', label: 'Return', render: (r) => <Pct v={r.returnPct} bold /> },
            { key: 'ann', label: 'Return a year', render: (r) => <Pct v={r.annualisedPct} /> },
          ]}
        />
      </Card>

      <Card title="Year by year" styles={{ body: { padding: 0 } }} size={size}>
        <ResponsiveRows<YearVsBench & { key: string }>
          rows={visibleYears.map((y) => ({ ...y, key: y.year }))}
          fields={[
            { key: 'year', label: 'Year', primary: true, render: (r) => r.year },
            { key: 'ret', label: 'Your return', render: (r) => <Pct v={r.returnPct} bold /> },
            { key: 'spy', label: 'SPY', render: (r) => <Pct v={r.benchmarkPct} /> },
            { key: 'diff', label: 'Difference', render: (r) => <Pct v={r.vsBenchmark} /> },
            { key: 'end', label: 'Value at year end', render: (r) => <Money v={r.endValue} /> },
            { key: 'paid', label: 'Paid in', render: (r) => <Money v={r.contributions} zeroDim /> },
            { key: 'inc', label: 'Dividends', render: (r) => <Money v={r.income} zeroDim /> },
            { key: 'gain', label: 'Gain', hideOnMobile: true, render: (r) => <Money v={r.gain} /> },
          ]}
        />
        {orderedYears.length > YEARS_SHOWN && !showAllYears && (
          <div style={{ padding: 12, textAlign: 'center' }}>
            <Button type="link" onClick={() => setShowAllYears(true)}>
              Load more ({orderedYears.length - YEARS_SHOWN} earlier {orderedYears.length - YEARS_SHOWN === 1 ? 'year' : 'years'})
            </Button>
          </div>
        )}
      </Card>
    </Space>
  );
}
