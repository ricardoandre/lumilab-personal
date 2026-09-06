'use client';

import { Card, Typography, Space, Grid, Alert } from 'antd';
import { ResponsiveRows } from './ResponsiveRows';
import { usd0, Pct, Money } from './money';

export interface ProjectionRow {
  key: string;
  name: string;
  lastEoyLabel: string;
  lastEoyValue: number;
  currentValue: number;
  annualised: number | null;
  irr: number | null;
  yearlyContribution: number;
  in5: number | null;
  in10: number | null;
  in5WithAdding: number | null;
  in10WithAdding: number | null;
}

export function ProjectionView({ rows }: { rows: ProjectionRow[] }) {
  const screens = Grid.useBreakpoint();
  const totalNow = rows.reduce((a, r) => a + r.currentValue, 0);
  const total5 = rows.reduce((a, r) => a + (r.in5WithAdding ?? r.in5 ?? r.currentValue), 0);
  const total10 = rows.reduce((a, r) => a + (r.in10WithAdding ?? r.in10 ?? r.currentValue), 0);

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card size={screens.lg ? 'default' : 'small'}>
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <Typography.Text strong>All accounts together</Typography.Text>
          <div style={{ fontSize: 13 }}>
            Worth <strong>{usd0(totalNow)}</strong> today · <strong>{usd0(total5)}</strong> in 5 years ·{' '}
            <strong>{usd0(total10)}</strong> in 10
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Assuming each account keeps earning what it has earned so far, and you keep adding at the
            same pace.
          </Typography.Text>
        </Space>
      </Card>

      <Card title="By account" styles={{ body: { padding: 0 } }} size={screens.lg ? 'default' : 'small'}>
        <ResponsiveRows<ProjectionRow>
          rows={rows}
          emptyText="No accounts with statements yet."
          fields={[
            { key: 'name', label: 'Account', primary: true, render: (r) => r.name },
            { key: 'eoy', label: `End ${r0(rows)} value`, render: (r) => <Money v={r.lastEoyValue} /> },
            { key: 'now', label: 'Value now', render: (r) => <Money v={r.currentValue} /> },
            { key: 'ret', label: 'Average return a year', render: (r) => <Pct v={r.annualised} bold /> },
            { key: 'irr', label: 'Your money’s rate (IRR)', render: (r) => <Pct v={r.irr} /> },
            { key: 'add', label: 'You add a year', render: (r) => <Money v={r.yearlyContribution} zeroDim /> },
            { key: 'p5', label: 'In 5 years', render: (r) => (r.in5 === null ? '—' : <Money v={r.in5WithAdding ?? r.in5} />) },
            { key: 'p10', label: 'In 10 years', render: (r) => (r.in10 === null ? '—' : <Money v={r.in10WithAdding ?? r.in10} />) },
          ]}
        />
      </Card>

      <Alert
        type="info"
        showIcon
        message="This is arithmetic, not a forecast"
        description={
          <>
            Each projection compounds today&apos;s value at the rate that account has achieved so far,
            and adds contributions at your recent pace. Markets do not deliver an average every year —
            2022 was −18% for SPY — so treat these as “what this rate would produce”, not a prediction.
            A short history makes the rate less reliable, not more.
          </>
        }
      />
    </Space>
  );
}

/** Year label for the "end of year" column — all accounts share the same one. */
function r0(rows: ProjectionRow[]): string {
  return rows[0]?.lastEoyLabel ?? '';
}
