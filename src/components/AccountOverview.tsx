'use client';

import Link from 'next/link';
import { Card, Typography, Space, Row, Col, Statistic, Tag, Alert, Grid } from 'antd';
import type { MonthRow, YearVsBench, Overview } from '@/lib/gotrade/report';
import { ResponsiveRows } from './ResponsiveRows';
import { StatementUpload } from './StatementUpload';
import { PortfolioChart } from './PortfolioChart';
import { usd, usd0, Pct, Money } from './money';

export function AccountOverview({
  accountId, accountName, overview, years, months, provider, currency, accountNo,
}: {
  accountId: string; accountName: string; provider: string; currency: string; accountNo: string | null;
  overview: Overview | null; years: YearVsBench[]; months: MonthRow[];
}) {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>{accountName}</Typography.Title>
        <Space size={6} wrap style={{ marginTop: 4 }}>
          <Tag>{provider}</Tag><Tag>{currency}</Tag>
          {accountNo && <Typography.Text type="secondary" style={{ fontSize: 12 }}>#{accountNo}</Typography.Text>}
        </Space>
      </div>

      {!overview ? (
        <Alert type="info" showIcon message="No statements yet"
          description="Upload your monthly statements below and the reports will build themselves." />
      ) : (
        <>
          <Row gutter={[12, 12]}>
            <Col xs={12} lg={6}>
              <Card size={isMobile ? 'small' : 'default'}>
                <Statistic title="Portfolio value" value={usd(overview.latestValue)} />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card size={isMobile ? 'small' : 'default'}>
                <Statistic title="Annualised return"
                  value={overview.annualised === null ? '—' : `${overview.annualised >= 0 ? '+' : ''}${(overview.annualised * 100).toFixed(2)}%`}
                  valueStyle={{ color: (overview.annualised ?? 0) >= 0 ? '#237804' : '#a8071a' }} />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card size={isMobile ? 'small' : 'default'}>
                <Statistic title="You paid in" value={usd0(overview.contributions)} />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card size={isMobile ? 'small' : 'default'}>
                <Statistic title="Investment earned" value={usd0(overview.gain)}
                  valueStyle={{ color: overview.gain >= 0 ? '#237804' : '#a8071a' }} />
              </Card>
            </Col>
          </Row>

          <Card size={isMobile ? 'small' : 'default'}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Typography.Text strong>Against just buying SPY</Typography.Text>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <span>You <Pct v={overview.annualised} bold /> a year</span>
                <span>SPY <Pct v={overview.benchAnnualised} bold /> a year</span>
              </div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                SPY including its dividends, over the same {overview.months} months.
              </Typography.Text>
            </Space>
          </Card>

          <PortfolioChart months={months} />

          <Card title="Year by year" styles={{ body: { padding: 0 } }} size={isMobile ? 'small' : 'default'}>
            <ResponsiveRows<YearVsBench & { key: string }>
              rows={years.map((y) => ({ ...y, key: y.year }))}
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
          </Card>

          <Card size={isMobile ? 'small' : 'default'}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Typography.Text strong>Idle cash</Typography.Text>
              <div>
                <Money v={overview.cash} /> sitting uninvested — {(overview.cashPct * 100).toFixed(1)}% of the account.
              </div>
              {overview.cashDragUsd !== null && (
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  Had that cash tracked SPY all along it would have earned about{' '}
                  <strong>{usd0(overview.cashDragUsd)}</strong> more. That is the price of the buffer,
                  not an argument against it — the same cash is why {years.find((y) => (y.vsBenchmark ?? 0) > 0)?.year ?? 'a down year'} hurt less.
                </Typography.Text>
              )}
            </Space>
          </Card>

          <Typography.Paragraph style={{ marginBottom: 0 }}>
            <Link href={`/accounts/${accountId}/report`}>Month-by-month and individual stocks →</Link>
          </Typography.Paragraph>
        </>
      )}

      <StatementUpload accountId={accountId} />
    </Space>
  );
}
