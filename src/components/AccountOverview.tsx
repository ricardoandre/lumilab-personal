'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Card, Typography, Space, Row, Col, Statistic, Tag, Alert, Grid, Button } from 'antd';
import type { MonthRow, YearVsBench, Overview, StockRow } from '@/lib/gotrade/report';
import { ResponsiveRows } from './ResponsiveRows';
import { StatementUploadButton } from './StatementUploadButton';
import { PortfolioChart } from './PortfolioChart';
import { usd, usd0, Pct, Money } from './money';

const YEARS_SHOWN = 3;

export function AccountOverview({
  accountId, accountName, overview, years, months, stocks, provider, currency, accountNo, latestStatement,
}: {
  accountId: string; accountName: string; provider: string; currency: string; accountNo: string | null;
  overview: Overview | null; years: YearVsBench[]; months: MonthRow[]; stocks: StockRow[];
  latestStatement: { period: string; fileName: string; importedAt: string; total: number } | null;
}) {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;
  const [showAllYears, setShowAllYears] = useState(false);

  // Newest first — the year you care about is this one, not 2021.
  const orderedYears = [...years].reverse();
  const visibleYears = showAllYears ? orderedYears : orderedYears.slice(0, YEARS_SHOWN);

  const size = isMobile ? ('small' as const) : ('default' as const);

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0 }}>
          <Typography.Title level={3} style={{ margin: 0 }}>{accountName}</Typography.Title>
          <Space size={6} wrap style={{ marginTop: 4 }}>
            <Tag>{provider}</Tag><Tag>{currency}</Tag>
            {accountNo && <Typography.Text type="secondary" style={{ fontSize: 12 }}>#{accountNo}</Typography.Text>}
          </Space>
        </div>
        <StatementUploadButton accountId={accountId} />
      </div>

      {!overview ? (
        <Alert type="info" showIcon message="No statements yet"
          description="Upload your monthly statements and the reports will build themselves." />
      ) : (
        <>
          {latestStatement && (
            <Alert
              type="info"
              showIcon
              message={`Figures are as at ${latestStatement.period} — the latest statement uploaded`}
              description={
                <span style={{ fontSize: 13 }}>
                  {latestStatement.fileName} · imported {latestStatement.importedAt} · {latestStatement.total} statements in total.
                  Anything after {latestStatement.period} is not in here yet.
                </span>
              }
            />
          )}

          <Row gutter={[12, 12]}>
            <Col xs={12} lg={6}><Card size={size}>
              <Statistic title="Portfolio value" value={usd(overview.latestValue)} />
            </Card></Col>
            <Col xs={12} lg={6}><Card size={size}>
              <Statistic title="Total return"
                value={overview.sinceInception === null ? '—' : `${overview.sinceInception >= 0 ? '+' : ''}${(overview.sinceInception * 100).toFixed(2)}%`}
                valueStyle={{ color: (overview.sinceInception ?? 0) >= 0 ? '#237804' : '#a8071a' }} />
            </Card></Col>
            <Col xs={12} lg={6}><Card size={size}>
              <Statistic title="Return a year"
                value={overview.annualised === null ? '—' : `${overview.annualised >= 0 ? '+' : ''}${(overview.annualised * 100).toFixed(2)}%`}
                valueStyle={{ color: (overview.annualised ?? 0) >= 0 ? '#237804' : '#a8071a' }} />
            </Card></Col>
            <Col xs={12} lg={6}><Card size={size}>
              <Statistic title="Investment earned" value={usd0(overview.gain)}
                valueStyle={{ color: overview.gain >= 0 ? '#237804' : '#a8071a' }} />
            </Card></Col>
          </Row>

          <Card size={size}>
            <Space direction="vertical" size={2} style={{ width: '100%' }}>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                You paid in <strong>{usd0(overview.contributions)}</strong>; it is now worth{' '}
                <strong>{usd0(overview.latestValue)}</strong>.
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                Of the {usd0(overview.gain)} earned, <strong>{usd(overview.income)}</strong> is dividends
                (after tax) and the rest is price growth.
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                Against just buying SPY: you <Pct v={overview.annualised} /> a year, SPY{' '}
                <Pct v={overview.benchAnnualised} /> a year.
              </Typography.Text>
            </Space>
          </Card>

          <Card title="Your stocks now" styles={{ body: { padding: 0 } }} size={size}
                extra={<Link href={`/accounts/${accountId}/report`} style={{ fontSize: 13 }}>Details →</Link>}>
            <ResponsiveRows<StockRow & { key: string }>
              rows={stocks.map((s) => ({ ...s, key: s.symbol }))}
              fields={[
                { key: 'sym', label: 'Symbol', primary: true, render: (r) => <Tag style={{ marginInlineEnd: 0 }}>{r.symbol}</Tag> },
                { key: 'val', label: 'Portfolio value', render: (r) => <Money v={r.marketValue} /> },
                { key: 'eq', label: 'Equity (your cost)', render: (r) => <Money v={r.costBasis} /> },
                { key: 'ret', label: 'Return', render: (r) => <Pct v={r.returnPct} bold /> },
                { key: 'ann', label: 'Return a year', render: (r) => <Pct v={r.annualisedPct} /> },
              ]}
            />
          </Card>

          <PortfolioChart months={months} />

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
        </>
      )}
    </Space>
  );
}
