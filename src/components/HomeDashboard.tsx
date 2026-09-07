'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Card, Typography, Space, Row, Col, Grid, Alert, Statistic, Button } from 'antd';
import { ResponsiveRows } from './ResponsiveRows';
import { PieChart, type Slice } from './PieChart';
import { StatCard, BreakdownLine, BreakdownNote, BreakdownStack } from './StatCard';
import { Pct } from './money';

const GREEN = '#237804';
const RED = '#a8071a';
const YEARS_SHOWN = 3;

const idr = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
const idrSigned = (n: number) => (n < 0 ? '-' : '') + 'Rp ' + Math.round(Math.abs(n)).toLocaleString('id-ID');
const idrShort = (n: number) => {
  if (Math.abs(n) >= 1e9) return `Rp ${(n / 1e9).toFixed(2)} M`;
  if (Math.abs(n) >= 1e6) return `Rp ${(n / 1e6).toFixed(0)} jt`;
  return idr(n);
};
const Money = ({ v }: { v: number }) => (
  <span style={{ fontVariantNumeric: 'tabular-nums', color: v < 0 ? RED : undefined }}>{idrSigned(v)}</span>
);

export interface AccountBreakdown {
  id: string; name: string; currency: string;
  valueIdr: number; valueNative: number; investedIdr: number; gainIdr: number;
  simpleReturn: number | null; annualised: number | null; irr: number | null;
  asOf: string; href: string;
}

export interface YearBreakdown {
  year: string;
  startValueIdr: number; endValueIdr: number; investedIdr: number; gainIdr: number;
  returnPct: number | null;
  byAccount: { name: string; investedIdr: number; gainIdr: number }[];
}

export function HomeDashboard({
  totalIdr, investmentsIdr, investmentsUsd, goldIdr, investedIdr, gainIdr,
  fxRate, fxFetchedAt, fxStale, goldPerGram, goldStale,
  simpleReturn, annualised, irr,
  years, accounts, projections, projectionRates, asOfLabel, coverage,
}: {
  totalIdr: number | null; investmentsIdr: number; investmentsUsd: number; goldIdr: number;
  investedIdr: number | null; gainIdr: number | null;
  fxRate: number | null; fxFetchedAt: string | null; fxStale: boolean;
  goldPerGram: number | null; goldStale: boolean;
  simpleReturn: number | null; annualised: number | null; irr: number | null;
  years: YearBreakdown[];
  accounts: AccountBreakdown[];
  projections: { years: number; stop: number; keep: number }[];
  projectionRates: { investments: number | null; gold: number | null };
  asOfLabel: string;
  coverage: { name: string; period: string }[];
}) {
  const screens = Grid.useBreakpoint();
  const small = !screens.lg;
  const [showAllYears, setShowAllYears] = useState(false);
  const pct = (v: number | null) => (v === null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`);

  const ordered = [...accounts].sort((a, b) => b.valueIdr - a.valueIdr);
  const slices: Slice[] = ordered.filter((a) => a.valueIdr > 0)
    .map((a) => ({ label: a.name, value: a.valueIdr, note: idrShort(a.valueIdr) }));
  const orderedYears = [...years].reverse();
  const visibleYears = showAllYears ? orderedYears : orderedYears.slice(0, YEARS_SHOWN);

  /** Per-account rows shared by several drawers. */
  const byAccount = (pick: (a: AccountBreakdown) => React.ReactNode, note?: (a: AccountBreakdown) => string | undefined) =>
    ordered.map((a) => <BreakdownLine key={a.id} label={a.name} note={note?.(a)} value={pick(a)} />);

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>Dashboard</Typography.Title>

      <StatCard
        title="Total net worth"
        value={totalIdr === null ? '—' : idr(totalIdr)}
        drawerTitle="What your net worth is made of"
        breakdown={
          <BreakdownStack>
            {ordered.map((a) => (
              <BreakdownLine key={a.id} label={a.name}
                note={a.currency !== 'IDR' ? `${a.valueNative.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}` : undefined}
                value={<Money v={a.valueIdr} />} />
            ))}
            <BreakdownLine label="Total" value={<Money v={totalIdr ?? 0} />} strong divider />
            <BreakdownNote>
              Dollar accounts converted at Rp {fxRate === null ? '—' : Math.round(fxRate).toLocaleString('id-ID')} to
              the dollar; gold valued at {goldPerGram === null ? '—' : idr(goldPerGram)} per gram, world spot.
            </BreakdownNote>
          </BreakdownStack>
        }
      />
      <Typography.Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: -12 }}>
        USD {fxRate === null ? '—' : idr(fxRate)}
        {goldPerGram !== null && <> · Gold {idr(goldPerGram)}/g</>}
        {(fxStale || goldStale) && fxFetchedAt && <> · last updated {fxFetchedAt}</>}
      </Typography.Text>

      <Row gutter={[12, 12]}>
        <Col xs={12} lg={6}>
          <StatCard small={small} title="Total money invested"
            value={investedIdr === null ? '—' : idr(investedIdr)}
            drawerTitle="Money you put in"
            breakdown={
              <BreakdownStack>
                {orderedYears.map((y) => (
                  <div key={y.year}>
                    <BreakdownLine label={y.year} value={<Money v={y.investedIdr} />} strong />
                    <div style={{ paddingLeft: 14, borderLeft: '2px solid #efebe3', marginBottom: 6 }}>
                      {y.byAccount.filter((r) => r.investedIdr !== 0).map((r) => (
                        <BreakdownLine key={r.name} label={r.name} value={<Money v={r.investedIdr} />} />
                      ))}
                      {y.byAccount.every((r) => r.investedIdr === 0) && (
                        <div style={{ fontSize: 12, color: '#9a9284', padding: '4px 0' }}>nothing paid in</div>
                      )}
                    </div>
                  </div>
                ))}
                <BreakdownLine label="Total" value={<Money v={investedIdr ?? 0} />} strong divider />
              </BreakdownStack>
            } />
        </Col>

        <Col xs={12} lg={6}>
          <StatCard small={small} title="Investment earned"
            value={gainIdr === null ? '—' : idrSigned(gainIdr)}
            valueColor={(gainIdr ?? 0) >= 0 ? GREEN : RED}
            drawerTitle="What you earned"
            breakdown={
              <BreakdownStack>
                {orderedYears.map((y) => (
                  <div key={y.year}>
                    <BreakdownLine label={y.year}
                      note={y.returnPct === null ? undefined : `${(y.returnPct * 100).toFixed(2)}% on investments`}
                      value={<Money v={y.gainIdr} />} strong />
                    <div style={{ paddingLeft: 14, borderLeft: '2px solid #efebe3', marginBottom: 6 }}>
                      {y.byAccount.filter((r) => r.gainIdr !== 0).map((r) => (
                        <BreakdownLine key={r.name} label={r.name} value={<Money v={r.gainIdr} />} />
                      ))}
                    </div>
                  </div>
                ))}
                <BreakdownLine label="Total" value={<Money v={gainIdr ?? 0} />} strong divider />
              </BreakdownStack>
            } />
        </Col>

        <Col xs={12} lg={6}>
          <StatCard small={small} title="Total return" value={pct(simpleReturn)}
            valueColor={(simpleReturn ?? 0) >= 0 ? GREEN : RED}
            drawerTitle="Total return by account"
            breakdown={
              <BreakdownStack>
                <BreakdownNote>
                  What your money grew by: everything it is worth now, against everything you put in.
                </BreakdownNote>
                <div style={{ marginTop: 16 }} />
                {byAccount((a) => <Pct v={a.simpleReturn} />, (a) => `${idrShort(a.investedIdr)} in, ${idrShort(a.valueIdr)} now`)}
                <BreakdownLine label="Everything together" value={<Pct v={simpleReturn} bold />} strong divider />
              </BreakdownStack>
            } />
        </Col>

        <Col xs={12} lg={6}>
          <StatCard small={small} title="Return a year" value={pct(annualised)}
            valueColor={(annualised ?? 0) >= 0 ? GREEN : RED}
            drawerTitle="Return a year by account"
            breakdown={
              <BreakdownStack>
                <BreakdownNote>
                  How the investments performed each year on average, with your deposits stripped out
                  so paying money in never looks like a gain. The headline figure covers the
                  statement accounts — gold has no month-by-month history to chain, so its own rate
                  is shown separately below.
                </BreakdownNote>
                <div style={{ marginTop: 16 }} />
                {byAccount((a) => <Pct v={a.annualised} />)}
                <BreakdownLine label="Statement accounts together" value={<Pct v={annualised} bold />} strong divider />
              </BreakdownStack>
            } />
        </Col>

        <Col xs={12} lg={6}>
          <StatCard small={small} title="Your money's rate (IRR)" value={pct(irr)}
            valueColor={(irr ?? 0) >= 0 ? GREEN : RED}
            drawerTitle="IRR by account"
            breakdown={
              <BreakdownStack>
                <BreakdownNote>
                  The one steady rate that would turn your actual deposits, on the dates you made
                  them, into today&apos;s balance — so unlike the others, it rewards good timing.
                </BreakdownNote>
                <div style={{ marginTop: 16 }} />
                {byAccount((a) => <Pct v={a.irr} />)}
                <BreakdownLine label="Statement accounts together" value={<Pct v={irr} bold />} strong divider />
              </BreakdownStack>
            } />
        </Col>

        <Col xs={12} lg={6}>
          <StatCard small={small} title="Accounts" value={String(accounts.length)} />
        </Col>
      </Row>

      <Card title="What it is made of" size={small ? 'small' : 'default'}>
        <PieChart slices={slices} centreValue={totalIdr === null ? '—' : idrShort(totalIdr)} centreLabel="net worth" />
      </Card>

      <Card title="Accounts" styles={{ body: { padding: 0 } }} size={small ? 'small' : 'default'}>
        <ResponsiveRows<AccountBreakdown & { key: string }>
          rows={ordered.map((a) => ({ ...a, key: a.id }))}
          fields={[
            { key: 'name', label: 'Account', primary: true, render: (r) => <Link href={r.href}>{r.name} →</Link> },
            {
              key: 'val', label: 'Value',
              render: (r) => (
                <span>
                  {idr(r.valueIdr)}
                  {r.currency !== 'IDR' && (
                    <span style={{ display: 'block', fontSize: 11, color: '#726c63' }}>
                      ${r.valueNative.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </span>
              ),
            },
            {
              key: 'share', label: 'Share',
              render: (r) => `${((r.valueIdr / (totalIdr || 1)) * 100).toFixed(1)}%`,
            },
            { key: 'ret', label: 'Return a year', render: (r) => <Pct v={r.annualised} /> },
            { key: 'asof', label: 'As at', render: (r) => r.asOf },
          ]}
        />
      </Card>

      <Card title="If this rate continues" size={small ? 'small' : 'default'}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '8px 14px', alignItems: 'baseline' }}>
          <span />
          <span style={{ fontSize: 12, color: '#726c63' }}>If you stop adding</span>
          <span style={{ fontSize: 12, color: '#726c63' }}>If you keep adding</span>
          {projections.map((p) => (
            <ProjectionRow key={p.years} label={`In ${p.years} years`} stop={idrShort(p.stop)} keep={idrShort(p.keep)} />
          ))}
        </div>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
          Each part grows at its OWN achieved rate — investments{' '}
          {projectionRates.investments === null ? '—' : `${(projectionRates.investments * 100).toFixed(1)}%`}, gold{' '}
          {projectionRates.gold === null ? '—' : `${(projectionRates.gold * 100).toFixed(1)}%`} — rather than one
          blended rate, which would quietly assume gold behaves like shares. Arithmetic, not a
          forecast: today&apos;s exchange rate is held constant and markets do not deliver an average
          every year.
        </Typography.Paragraph>
      </Card>

      <Card title="Year by year" styles={{ body: { padding: 0 } }} size={small ? 'small' : 'default'}>
        <ResponsiveRows<YearBreakdown & { key: string }>
          rows={visibleYears.map((y) => ({ ...y, key: y.year }))}
          fields={[
            { key: 'year', label: 'Year', primary: true, render: (r) => r.year },
            { key: 'start', label: 'Net worth at start', render: (r) => <Money v={r.startValueIdr} /> },
            { key: 'end', label: 'Net worth at end', render: (r) => <Money v={r.endValueIdr} /> },
            { key: 'paid', label: 'Paid in', render: (r) => <Money v={r.investedIdr} /> },
            { key: 'gain', label: 'Net gain', render: (r) => <Money v={r.gainIdr} /> },
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

      <Alert type="info" showIcon message={`Counted from statements up to ${asOfLabel}`}
        description={
          <>
            {coverage.map((c) => <div key={c.name}>{c.name} — {c.period}</div>)}
            <div style={{ marginTop: 6 }}>
              Where accounts end on different months, the older one keeps its last known value rather
              than dropping to zero, which would look like a crash across the whole portfolio.
            </div>
          </>
        } />
    </Space>
  );
}

function ProjectionRow({ label, stop, keep }: { label: string; stop: string; keep: string }) {
  return (
    <>
      <span style={{ fontSize: 13, color: '#726c63' }}>{label}</span>
      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{stop}</strong>
      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{keep}</strong>
    </>
  );
}
