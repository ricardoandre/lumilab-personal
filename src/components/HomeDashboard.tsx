'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Card, Typography, Space, Row, Col, Grid, Alert, Statistic, Button } from 'antd';
import type { CombinedYear } from '@/lib/gotrade/report';
import { ResponsiveRows } from './ResponsiveRows';
import { PieChart, type Slice } from './PieChart';
import { StatCard, BreakdownLine, BreakdownNote, BreakdownStack } from './StatCard';
import { usd, usd0, Pct, Money } from './money';

const GREEN = '#237804';
const RED = '#a8071a';
const YEARS_SHOWN = 3;

export interface AccountSlice {
  id: string; name: string; value: number; currency: string;
  annualised: number | null; asOf: string;
}

export function HomeDashboard({
  totalUsd, totalIdr, fxRate, fxFetchedAt, fxStale,
  contributions, gain, simpleReturn, annualised, irr,
  years, accounts, projections, asOfLabel, coverage,
}: {
  totalUsd: number; totalIdr: number | null;
  fxRate: number | null; fxFetchedAt: string | null; fxStale: boolean;
  contributions: number; gain: number;
  simpleReturn: number | null; annualised: number | null; irr: number | null;
  years: CombinedYear[];
  accounts: AccountSlice[];
  projections: { years: number; stop: number; keep: number }[];
  asOfLabel: string;
  coverage: { name: string; period: string }[];
}) {
  const screens = Grid.useBreakpoint();
  const small = !screens.lg;
  const [showAllYears, setShowAllYears] = useState(false);
  const pct = (v: number | null) => (v === null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`);
  const idr = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
  // Compact rupiah for the projection grid, where full digits would wrap on a phone.
  const idrShort = (n: number) => {
    if (n >= 1e9) return `Rp ${(n / 1e9).toFixed(2)} M`;   // miliar
    if (n >= 1e6) return `Rp ${(n / 1e6).toFixed(0)} jt`;  // juta
    return idr(n);
  };

  // One order everywhere: largest account first, in the pie and in the list under it.
  const ordered = [...accounts].sort((a, b) => b.value - a.value);
  const slices: Slice[] = ordered.filter((a) => a.value > 0).map((a) => ({
    label: a.name, value: a.value, note: usd(a.value),
  }));

  const orderedYears = [...years].reverse();
  const visibleYears = showAllYears ? orderedYears : orderedYears.slice(0, YEARS_SHOWN);

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>Dashboard</Typography.Title>

      <Card size={small ? 'small' : 'default'}>
        <Statistic title="Total net worth" value={totalIdr === null ? '—' : idr(totalIdr)}
          valueStyle={{ fontSize: small ? 26 : 34 }} />
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {usd(totalUsd)}
          {fxRate !== null && <> · at Rp {Math.round(fxRate).toLocaleString('id-ID')} to the dollar</>}
        </Typography.Text>
        {fxStale && fxFetchedAt && (
          <div style={{ marginTop: 6 }}>
            <Typography.Text type="warning" style={{ fontSize: 12 }}>
              Live rate unavailable — using the rate from {fxFetchedAt}.
            </Typography.Text>
          </div>
        )}
      </Card>

      <Row gutter={[12, 12]}>
        <Col xs={12} lg={6}>
          <StatCard small={small} title="Total money invested" value={usd(contributions)}
            drawerTitle="Money you put in"
            breakdown={
              <BreakdownStack>
                <BreakdownNote>Across every account, paid in year by year.</BreakdownNote>
                <div style={{ marginTop: 16 }} />
                {orderedYears.map((y) => (
                  <BreakdownLine key={y.year} label={y.year} value={<Money v={y.contributions} zeroDim />} />
                ))}
                <BreakdownLine label="Total" value={<Money v={contributions} />} strong divider />
              </BreakdownStack>
            } />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard small={small} title="Investment earned" value={usd0(gain)}
            valueColor={gain >= 0 ? GREEN : RED}
            drawerTitle="Earned, year by year"
            breakdown={
              <BreakdownStack>
                {orderedYears.map((y) => (
                  <BreakdownLine key={y.year} label={y.year}
                    note={y.returnPct === null ? undefined : `${(y.returnPct * 100).toFixed(2)}%`}
                    value={<Money v={y.gain} />} />
                ))}
                <BreakdownLine label="Total" value={<Money v={gain} />} strong divider />
              </BreakdownStack>
            } />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard small={small} title="Total return" value={pct(simpleReturn)}
            valueColor={(simpleReturn ?? 0) >= 0 ? GREEN : RED} />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard small={small} title="Return a year" value={pct(annualised)}
            valueColor={(annualised ?? 0) >= 0 ? GREEN : RED} />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard small={small} title="Your money's rate (IRR)" value={pct(irr)}
            valueColor={(irr ?? 0) >= 0 ? GREEN : RED}
            drawerTitle="Combined IRR"
            breakdown={
              <BreakdownStack>
                <BreakdownNote>
                  Every deposit into every account, on the day it was made, against what the whole
                  portfolio is worth today.
                </BreakdownNote>
                <div style={{ marginTop: 16 }} />
                <BreakdownLine label="Your money's rate (IRR)" value={<Pct v={irr} bold />} />
                <BreakdownLine label="Annualised return" value={<Pct v={annualised} />} />
              </BreakdownStack>
            } />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard small={small} title="Accounts" value={String(accounts.length)} />
        </Col>
      </Row>

      <Card title="What it is made of" size={small ? 'small' : 'default'}>
        <PieChart slices={slices} centreValue={usd0(totalUsd)} centreLabel="total" />
      </Card>

      <Card title="Accounts" styles={{ body: { padding: 0 } }} size={small ? 'small' : 'default'}>
        <ResponsiveRows<AccountSlice & { key: string }>
          rows={ordered.map((a) => ({ ...a, key: a.id }))}
          fields={[
            {
              key: 'name', label: 'Account', primary: true,
              render: (r) => <Link href={`/accounts/${r.id}`}>{r.name} →</Link>,
            },
            { key: 'val', label: 'Value', render: (r) => <Money v={r.value} /> },
            { key: 'share', label: 'Share', render: (r) => `${((r.value / (totalUsd || 1)) * 100).toFixed(1)}%` },
            { key: 'ret', label: 'Return a year', render: (r) => <Pct v={r.annualised} /> },
            { key: 'asof', label: 'Latest statement', render: (r) => r.asOf },
          ]}
        />
      </Card>

      <Card title="If this rate continues" size={small ? 'small' : 'default'}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '8px 14px', alignItems: 'baseline',
        }}>
          <span />
          <span style={{ fontSize: 12, color: '#726c63' }}>If you stop adding</span>
          <span style={{ fontSize: 12, color: '#726c63' }}>If you keep adding</span>
          {projections.map((p) => (
            <ProjectionRow
              key={p.years}
              label={`In ${p.years} years`}
              stopUsd={usd0(p.stop)}
              keepUsd={usd0(p.keep)}
              stopIdr={fxRate === null ? null : idrShort(p.stop * fxRate)}
              keepIdr={fxRate === null ? null : idrShort(p.keep * fxRate)}
            />
          ))}
        </div>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
          Arithmetic, not a forecast: today&apos;s balance compounded at the rate achieved so far.
          Rupiah figures use today&apos;s exchange rate throughout, so they assume it does not move —
          over ten years it certainly will.
        </Typography.Paragraph>
      </Card>

      <Card title="Year by year" styles={{ body: { padding: 0 } }} size={small ? 'small' : 'default'}>
        <ResponsiveRows<CombinedYear & { key: string }>
          rows={visibleYears.map((y) => ({ ...y, key: y.year }))}
          fields={[
            { key: 'year', label: 'Year', primary: true, render: (r) => r.year },
            { key: 'start', label: 'Net worth at start', render: (r) => <Money v={r.startValue} /> },
            { key: 'end', label: 'Net worth at end', render: (r) => <Money v={r.endValue} /> },
            { key: 'paid', label: 'Paid in', render: (r) => <Money v={r.contributions} zeroDim /> },
            { key: 'gain', label: 'Net gain', render: (r) => <Money v={r.gain} /> },
            { key: 'ret', label: 'Return', render: (r) => <Pct v={r.returnPct} bold /> },
          ]}
        />
        {orderedYears.length > YEARS_SHOWN && !showAllYears && (
          <div style={{ padding: 12, textAlign: 'center' }}>
            <Button type="link" onClick={() => setShowAllYears(true)}>
              Load more ({orderedYears.length - YEARS_SHOWN} earlier{' '}
              {orderedYears.length - YEARS_SHOWN === 1 ? 'year' : 'years'})
            </Button>
          </div>
        )}
      </Card>

      <Alert
        type="info"
        showIcon
        message={`Counted from statements up to ${asOfLabel}`}
        description={
          <>
            {coverage.map((c) => <div key={c.name}>{c.name} — {c.period}</div>)}
            <div style={{ marginTop: 6 }}>
              Where accounts end on different months, the older one keeps its last known value
              rather than dropping to zero, which would look like a crash across the whole portfolio.
            </div>
          </>
        }
      />
    </Space>
  );
}

/** Three grid siblings — a wrapper element would break the column alignment. */
function ProjectionRow({
  label, stopUsd, keepUsd, stopIdr, keepIdr,
}: { label: string; stopUsd: string; keepUsd: string; stopIdr: string | null; keepIdr: string | null }) {
  return (
    <>
      <span style={{ fontSize: 13, color: '#726c63' }}>{label}</span>
      <span>
        <strong style={{ fontVariantNumeric: 'tabular-nums', display: 'block' }}>{stopUsd}</strong>
        {stopIdr && <span style={{ fontSize: 11, color: '#726c63' }}>{stopIdr}</span>}
      </span>
      <span>
        <strong style={{ fontVariantNumeric: 'tabular-nums', display: 'block' }}>{keepUsd}</strong>
        {keepIdr && <span style={{ fontSize: 11, color: '#726c63' }}>{keepIdr}</span>}
      </span>
    </>
  );
}
