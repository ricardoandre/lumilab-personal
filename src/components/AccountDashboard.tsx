'use client';

import Link from 'next/link';
import { Card, Typography, Space, Row, Col, Tag, Alert, Grid, Button } from 'antd';
import type { MonthRow, Overview, StockRow, YearVsBench } from '@/lib/gotrade/report';
import { ResponsiveRows } from './ResponsiveRows';
import { StatementUploadButton } from './StatementUploadButton';
import { PortfolioChart } from './PortfolioChart';
import { AccountStats } from './AccountStats';
import { DataHealthAlert } from './DataHealthAlert';
import { YearMetrics } from './YearMetrics';
import { usd0, Pct, Money } from './money';

const GREEN = '#237804';
const RED = '#a8071a';

export function AccountDashboard({
  accountId, accountName, provider, currency, accountNo,
  overview, stocks, months, thisYear, thisYearMonths, asAt, missing, failed,
}: {
  accountId: string; accountName: string; provider: string; currency: string; accountNo: string | null;
  overview: Overview | null; stocks: StockRow[]; months: MonthRow[];
  thisYear: YearVsBench | null; thisYearMonths: MonthRow[];
  asAt: { period: string; monthsBehind: number } | null;
  missing: string[]; failed: { fileName: string; reason: string }[];
}) {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;
  const size = isMobile ? ('small' as const) : ('default' as const);
  const pct = (v: number | null) => (v === null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`);

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

      <DataHealthAlert missing={missing} failed={failed} asAt={asAt} />

      {!overview ? (
        <Alert type="info" showIcon message="No statements yet"
          description="Upload your monthly statements and the reports will build themselves." />
      ) : (
        <>
          <AccountStats overview={overview} stocks={stocks} />

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
                </Typography.Text>
              )}
            </Space>
          </Card>

          <Link href={`/accounts/${accountId}/report`}>
            <Button block size="large">Full report →</Button>
          </Link>

          {thisYear && (
            <Card
              title={`${thisYear.year} so far`}
              size={size}
              styles={{ body: { padding: 0 } }}
            >
              <div style={{ padding: 12 }}>
                <YearMetrics year={thisYear} cash={overview.cash} />
                <PortfolioChart months={thisYearMonths} bare />
              </div>
              <ResponsiveRows<StockRow & { key: string }>
                rows={stocks.map((s) => ({ ...s, key: s.symbol }))}
                fields={[
                  { key: 'sym', label: 'Symbol', primary: true, render: (r) => <Tag style={{ marginInlineEnd: 0 }}>{r.symbol}</Tag> },
                  { key: 'val', label: 'Portfolio value', render: (r) => <Money v={r.marketValue} /> },
                  { key: 'ret', label: 'Return', render: (r) => <Pct v={r.returnPct} bold /> },
                  { key: 'ann', label: 'Return a year', render: (r) => <Pct v={r.annualisedPct} /> },
                ]}
              />
            </Card>
          )}

        </>
      )}
    </Space>
  );
}
