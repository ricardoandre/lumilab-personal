'use client';

import { Card, Typography, Space, Tag, Alert, Grid } from 'antd';
import type { MonthRow, Overview, StockRow, StockYearRow, YearVsBench, YearIrr } from '@/lib/gotrade/report';
import { ResponsiveRows } from './ResponsiveRows';
import { StatementUploadButton } from './StatementUploadButton';
import { PortfolioChart } from './PortfolioChart';
import { AccountStats } from './AccountStats';
import { DataHealthAlert } from './DataHealthAlert';
import { YearMetrics } from './YearMetrics';
import { ConcentrationCard } from './ConcentrationCard';
import { StockLabel } from './StockIcon';
import { Pct, Money, CurrencyProvider, formatMoney } from './money';

const GREEN = '#237804';
const RED = '#a8071a';

export function AccountDashboard({
  accountId, accountName, provider, currency, accountNo,
  overview, stocks, months, thisYear, thisYearMonths, yearStocks, irr, irrYears, years, asAt, missing, failed, holdings,
}: {
  accountId: string; accountName: string; provider: string; currency: string; accountNo: string | null;
  overview: Overview | null; stocks: StockRow[]; months: MonthRow[];
  thisYear: YearVsBench | null; thisYearMonths: MonthRow[];
  yearStocks: StockYearRow[]; irr: number | null; irrYears: YearIrr[]; years: YearVsBench[];
  holdings?: { asOf: string; staleMonths: number } | null;
  asAt: { period: string; monthsBehind: number } | null;
  missing: string[]; failed: { fileName: string; reason: string }[];
}) {
  // The account's own currency, already a prop here.
  const money = (n: number) => formatMoney(n, currency);
  const money0 = (n: number) => formatMoney(n, currency, { compact: true });

  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;
  const size = isMobile ? ('small' as const) : ('default' as const);
  const pct = (v: number | null) => (v === null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`);

  return (
    <CurrencyProvider value={currency}>
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0 }}>
          <Typography.Title level={3} style={{ margin: 0 }}>{accountName}</Typography.Title>
          <Space size={6} wrap style={{ marginTop: 4 }}>
            <Tag>{provider}</Tag><Tag>{currency}</Tag>
            {accountNo && <Typography.Text type="secondary" style={{ fontSize: 12 }}>#{accountNo}</Typography.Text>}
          </Space>
        </div>
        <StatementUploadButton accountId={accountId} provider={provider} />
      </div>

      <DataHealthAlert missing={missing} failed={failed} asAt={asAt} holdings={holdings} />

      {!overview ? (
        <Alert type="info" showIcon message="No statements yet"
          description="Upload your monthly statements and the reports will build themselves." />
      ) : (
        <>
          <AccountStats overview={overview} stocks={stocks} years={years} irr={irr} irrYears={irrYears} />

          {/* Only where a benchmark exists. An Indonesian account has no SPY to
              compare with, and the card read "SPY — a year". */}
          {overview.benchAnnualised !== null && (
            <Card size={size}>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                Against just buying SPY: you <Pct v={overview.annualised} /> a year, SPY{' '}
                <Pct v={overview.benchAnnualised} /> a year.
              </Typography.Text>
            </Card>
          )}

          <ConcentrationCard overview={overview} stocks={stocks} />

          <Card size={size}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Typography.Text strong>Idle cash</Typography.Text>
              <div><Money v={overview.cash} /> uninvested — {(overview.cashPct * 100).toFixed(1)}% of the account.</div>
              {overview.cashDragUsd !== null && (
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  Had it tracked SPY it would have earned about <strong>{money0(overview.cashDragUsd)}</strong> more.
                </Typography.Text>
              )}
            </Space>
          </Card>

          {thisYear && (
            <Card
              title={`${thisYear.year} so far`}
              size={size}
              styles={{ body: { padding: 0 } }}
            >
              <div style={{ padding: 12 }}>
                <YearMetrics year={thisYear} cash={overview.cash} stocks={yearStocks} />
              </div>
              <ResponsiveRows<StockYearRow & { key: string }>
                rows={[...yearStocks].sort((a, b) => (b.yearReturnPct ?? -Infinity) - (a.yearReturnPct ?? -Infinity))
                  .map((s) => ({ ...s, key: s.symbol }))}
                fields={[
                  { key: 'sym', label: 'Stock', primary: true, render: (r) => <StockLabel symbol={r.symbol} name={r.name} /> },
                  { key: 'yret', label: `${thisYear.year} return`, render: (r) => <Pct v={r.yearReturnPct} bold /> },
                  { key: 'ygain', label: `${thisYear.year} earned`, render: (r) => <Money v={r.yearGain} compact /> },
                  { key: 'start', label: `End ${Number(thisYear.year) - 1}`, render: (r) => <Money v={r.startValue} zeroDim compact /> },
                  { key: 'bought', label: 'Bought this year', render: (r) => <Money v={r.netTraded} zeroDim compact /> },
                  { key: 'val', label: 'Value now', render: (r) => <Money v={r.marketValue} compact /> },
                  {
                    key: 'weight', label: 'Share of account',
                    render: (r) => `${(r.weightPct * 100).toFixed(1)}%`,
                  },
                ]}
              />
            </Card>
          )}

        </>
      )}
    </Space>
    </CurrencyProvider>
  );
}