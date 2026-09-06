'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Card, Typography, Space, Row, Col, Tag, Alert, Grid, Button } from 'antd';
import type { MonthRow, YearVsBench, Overview, StockRow } from '@/lib/gotrade/report';
import { ResponsiveRows } from './ResponsiveRows';
import { StatementUploadButton } from './StatementUploadButton';
import { PortfolioChart } from './PortfolioChart';
import { StatCard, BreakdownLine, BreakdownNote, BreakdownStack } from './StatCard';
import { usd, usd0, Pct, Money } from './money';

const YEARS_SHOWN = 3;
const GREEN = '#237804';
const RED = '#a8071a';

export function AccountOverview({
  accountId, accountName, overview, years, months, stocks, provider, currency, accountNo, asAt,
}: {
  accountId: string; accountName: string; provider: string; currency: string; accountNo: string | null;
  overview: Overview | null; years: YearVsBench[]; months: MonthRow[]; stocks: StockRow[];
  asAt: { period: string; monthsBehind: number } | null;
}) {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;
  const size = isMobile ? ('small' as const) : ('default' as const);
  const [showAllYears, setShowAllYears] = useState(false);

  const orderedYears = [...years].reverse();
  const visibleYears = showAllYears ? orderedYears : orderedYears.slice(0, YEARS_SHOWN);

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

      {!overview ? (
        <Alert type="info" showIcon message="No statements yet"
          description="Upload your monthly statements and the reports will build themselves." />
      ) : (
        <>
          {/* Quiet when current, loud when not. A number four months stale looks
              exactly like a fresh one unless something says otherwise. */}
          {asAt && asAt.monthsBehind >= 2 ? (
            <Alert
              type="warning"
              showIcon
              message={`Last statement: ${asAt.period} — about ${asAt.monthsBehind} months out of date`}
              description="Upload your newer statements to bring these figures up to date."
            />
          ) : asAt ? (
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>As at {asAt.period}</Typography.Text>
          ) : null}

          <Row gutter={[12, 12]}>
            <Col xs={12} lg={6}>
              <StatCard
                small={isMobile}
                title="Portfolio value"
                value={usd(overview.latestValue)}
                drawerTitle="What makes up the value"
                breakdown={
                  <BreakdownStack>
                    {stocks.map((s) => (
                      <BreakdownLine key={s.symbol} label={s.symbol} note={s.name ?? undefined}
                        value={<Money v={s.marketValue} />} />
                    ))}
                    <BreakdownLine label="Cash" note="uninvested" value={<Money v={overview.cash} />} divider />
                    <BreakdownLine label="Total" value={<Money v={overview.latestValue} />} strong divider />
                    <BreakdownNote>
                      Share prices are those printed on your latest statement — the only price
                      source there is, since Gotrade has no API.
                    </BreakdownNote>
                  </BreakdownStack>
                }
              />
            </Col>

            <Col xs={12} lg={6}>
              <StatCard
                small={isMobile}
                title="Total return"
                value={pct(overview.sinceInception)}
                valueColor={(overview.sinceInception ?? 0) >= 0 ? GREEN : RED}
                drawerTitle="Where the return came from"
                breakdown={
                  <BreakdownStack>
                    <BreakdownLine label="Share price growth" value={<Money v={overview.priceGrowth} />} />
                    <BreakdownLine label="Dividends received" value={<Money v={overview.dividends} />} />
                    <BreakdownLine label="Withholding tax" note="15% US tax on dividends"
                      value={<Money v={overview.tax} />} />
                    <BreakdownLine label="Gotrade rewards" note="promotional credits"
                      value={<Money v={overview.rewards} />} />
                    <BreakdownLine label="Total earned" value={<Money v={overview.gain} />} strong divider />

                    <div style={{ marginTop: 20, marginBottom: 4, fontWeight: 600 }}>By stock</div>
                    {stocks.map((s) => (
                      <BreakdownLine
                        key={s.symbol}
                        label={s.symbol}
                        note={`${usd(s.unrealized)} price${s.dividends ? ` + ${usd(s.dividends)} dividends` : ''}`}
                        value={<Pct v={s.returnPct} />}
                      />
                    ))}
                    <BreakdownNote>
                      Return is time-weighted, so money you paid in is never counted as a gain.
                      Dividends are shown gross with the tax listed separately — what reached your
                      account is the two combined.
                    </BreakdownNote>
                  </BreakdownStack>
                }
              />
            </Col>

            <Col xs={12} lg={6}>
              <StatCard small={isMobile} title="Return a year" value={pct(overview.annualised)}
                valueColor={(overview.annualised ?? 0) >= 0 ? GREEN : RED} />
            </Col>
            <Col xs={12} lg={6}>
              <StatCard small={isMobile} title="Investment earned" value={usd0(overview.gain)}
                valueColor={overview.gain >= 0 ? GREEN : RED} />
            </Col>
          </Row>

          <Card size={size}>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              Against just buying SPY: you <Pct v={overview.annualised} /> a year, SPY{' '}
              <Pct v={overview.benchAnnualised} /> a year.
            </Typography.Text>
          </Card>

          <Card title="Your stocks now" styles={{ body: { padding: 0 } }} size={size}
                extra={<Link href={`/accounts/${accountId}/report`} style={{ fontSize: 13 }}>Details →</Link>}>
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
