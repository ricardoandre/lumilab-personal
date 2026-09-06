'use client';

import { Card, Typography, Space, Table, Tag, Statistic, Row, Col, Segmented, Empty } from 'antd';
import { useState } from 'react';
import type { MonthRow, YearRow, StockRow } from '@/lib/gotrade/report';

const usd = (n: number) =>
  (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Pct({ v }: { v: number | null }) {
  if (v === null) return <span style={{ color: '#999' }}>—</span>;
  const pct = v * 100;
  return <span style={{ color: pct >= 0 ? '#237804' : '#a8071a', fontVariantNumeric: 'tabular-nums' }}>
    {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
  </span>;
}
const Money = ({ v }: { v: number }) => (
  <span style={{ fontVariantNumeric: 'tabular-nums', color: v < 0 ? '#a8071a' : undefined }}>{usd(v)}</span>
);

export function GotradeReport({
  accountName, months, years, stocks,
}: { accountName: string; months: MonthRow[]; years: YearRow[]; stocks: StockRow[] }) {
  const [view, setView] = useState<'Monthly' | 'Yearly'>('Yearly');

  if (!months.length) {
    return <Card><Empty description="No statements imported for this account yet." /></Card>;
  }

  const latest = months[months.length - 1];
  const totalContrib = months.reduce((a, m) => a + m.contributions, 0);
  const totalIncome = months.reduce((a, m) => a + m.income, 0);
  const totalGain = months.reduce((a, m) => a + m.gain, 0);
  // Chained across every month = time-weighted return since inception.
  const since = months.filter((m) => m.returnPct !== null)
    .reduce((acc, m) => acc * (1 + (m.returnPct as number)), 1) - 1;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>{accountName} — Report</Typography.Title>

      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}><Card><Statistic title="Portfolio value" value={usd(latest.portfolioValue)} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Money paid in" value={usd(totalContrib)} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Investment gain" value={usd(totalGain)}
          valueStyle={{ color: totalGain >= 0 ? '#237804' : '#a8071a' }} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Return since start"
          value={`${since >= 0 ? '+' : ''}${(since * 100).toFixed(2)}%`}
          valueStyle={{ color: since >= 0 ? '#237804' : '#a8071a' }} /></Card></Col>
      </Row>

      <Card
        title="Portfolio return"
        extra={<Segmented options={['Yearly', 'Monthly']} value={view} onChange={(v) => setView(v as 'Monthly' | 'Yearly')} />}
        styles={{ body: { padding: 0 } }}
      >
        {view === 'Yearly' ? (
          <Table<YearRow>
            dataSource={years.map((y) => ({ ...y, key: y.year }))}
            pagination={false}
            scroll={{ x: true }}
            columns={[
              { title: 'Year', dataIndex: 'year' },
              { title: 'Start', dataIndex: 'startValue', align: 'right', render: (v: number) => <Money v={v} /> },
              { title: 'End', dataIndex: 'endValue', align: 'right', render: (v: number) => <Money v={v} /> },
              { title: 'Paid in', dataIndex: 'contributions', align: 'right', render: (v: number) => <Money v={v} /> },
              { title: 'Income', dataIndex: 'income', align: 'right', render: (v: number) => <Money v={v} /> },
              { title: 'Gain', dataIndex: 'gain', align: 'right', render: (v: number) => <Money v={v} /> },
              { title: 'Return', dataIndex: 'returnPct', align: 'right', render: (v: number | null) => <Pct v={v} /> },
            ]}
          />
        ) : (
          <Table<MonthRow>
            dataSource={[...months].reverse().map((m) => ({ ...m, key: m.period }))}
            pagination={{ pageSize: 12, showSizeChanger: false }}
            scroll={{ x: true }}
            columns={[
              { title: 'Month', dataIndex: 'period' },
              { title: 'Cash', dataIndex: 'cash', align: 'right', render: (v: number) => <Money v={v} /> },
              { title: 'Holdings', dataIndex: 'holdingsValue', align: 'right', render: (v: number) => <Money v={v} /> },
              { title: 'Total', dataIndex: 'portfolioValue', align: 'right', render: (v: number) => <Money v={v} /> },
              { title: 'Paid in', dataIndex: 'contributions', align: 'right', render: (v: number) => <Money v={v} /> },
              { title: 'Income', dataIndex: 'income', align: 'right', render: (v: number) => <Money v={v} /> },
              { title: 'Gain', dataIndex: 'gain', align: 'right', render: (v: number) => <Money v={v} /> },
              { title: 'Return', dataIndex: 'returnPct', align: 'right', render: (v: number | null) => <Pct v={v} /> },
            ]}
          />
        )}
      </Card>

      <Card title="Individual stocks" styles={{ body: { padding: 0 } }}>
        <Table<StockRow>
          dataSource={stocks.map((s) => ({ ...s, key: s.symbol }))}
          pagination={false}
          scroll={{ x: true }}
          columns={[
            { title: 'Symbol', dataIndex: 'symbol', render: (v: string) => <Tag>{v}</Tag> },
            { title: 'Name', dataIndex: 'name', ellipsis: true },
            { title: 'Qty', dataIndex: 'quantity', align: 'right' },
            { title: 'Cost', dataIndex: 'costBasis', align: 'right', render: (v: number) => <Money v={v} /> },
            { title: 'Value', dataIndex: 'marketValue', align: 'right', render: (v: number) => <Money v={v} /> },
            { title: 'Unrealised', dataIndex: 'unrealized', align: 'right', render: (v: number) => <Money v={v} /> },
            { title: 'Dividends', dataIndex: 'dividends', align: 'right', render: (v: number) => <Money v={v} /> },
            { title: 'Total return', dataIndex: 'returnPct', align: 'right', render: (v: number | null) => <Pct v={v} /> },
          ]}
        />
      </Card>

      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        Return is time-weighted (Modified Dietz), so paying money in does not count as a gain.
        Each contribution is weighted by how long it was actually invested. Yearly figures chain
        the months rather than comparing January to December, which would ignore mid-year deposits.
      </Typography.Paragraph>
    </Space>
  );
}
