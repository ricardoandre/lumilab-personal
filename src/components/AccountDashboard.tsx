'use client';

import Link from 'next/link';
import { Card, Typography, Space, Row, Col, Tag, Alert, Grid, Button } from 'antd';
import type { MonthRow, Overview, StockRow, YearVsBench } from '@/lib/gotrade/report';
import { ResponsiveRows } from './ResponsiveRows';
import { StatementUploadButton } from './StatementUploadButton';
import { PortfolioChart } from './PortfolioChart';
import { StatCard, BreakdownLine, BreakdownNote, BreakdownStack } from './StatCard';
import { DataHealthAlert } from './DataHealthAlert';
import { usd, usd0, Pct, Money } from './money';

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
          <Row gutter={[12, 12]}>
            <Col xs={12} lg={6}>
              <StatCard small={isMobile} title="Portfolio value" value={usd(overview.latestValue)}
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
            </Col>
            <Col xs={12} lg={6}>
              <StatCard small={isMobile} title="Total return" value={pct(overview.sinceInception)}
                valueColor={(overview.sinceInception ?? 0) >= 0 ? GREEN : RED}
                drawerTitle="Return by stock"
                breakdown={
                  <BreakdownStack>
                    {stocks.map((s) => (
                      <BreakdownLine key={s.symbol} label={s.symbol} note={s.name ?? undefined}
                        value={<Pct v={s.returnPct} />} />
                    ))}
                    <BreakdownLine label="Whole account" value={<Pct v={overview.sinceInception} />} strong divider />
                    <BreakdownNote>
                      Percentages only — the money each of these is worth is under Investment earned.
                      The account figure is time-weighted, so it is not the average of the rows above:
                      money you paid in is never counted as a gain.
                    </BreakdownNote>
                  </BreakdownStack>
                } />
            </Col>
            <Col xs={12} lg={6}>
              <StatCard small={isMobile} title="Return a year" value={pct(overview.annualised)}
                valueColor={(overview.annualised ?? 0) >= 0 ? GREEN : RED} />
            </Col>
            <Col xs={12} lg={6}>
              <StatCard small={isMobile} title="Investment earned" value={usd0(overview.gain)}
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
                    <BreakdownNote>
                      Gotrade&apos;s promotional credits ({usd(overview.rewards)}) count as money paid in,
                      not as return, so a broker giveaway cannot flatter how your own capital performed.
                    </BreakdownNote>
                  </BreakdownStack>
                } />
            </Col>
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
                </Typography.Text>
              )}
            </Space>
          </Card>

          {thisYear && (
            <Card
              title={`${thisYear.year} so far`}
              size={size}
              styles={{ body: { padding: 0 } }}
              extra={
                <span style={{ fontSize: 13 }}>
                  you <Pct v={thisYear.returnPct} bold /> · SPY <Pct v={thisYear.benchmarkPct} />
                </span>
              }
            >
              <div style={{ padding: 12 }}>
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

          <Link href={`/accounts/${accountId}/report`}>
            <Button block size="large">Full report →</Button>
          </Link>
        </>
      )}
    </Space>
  );
}
