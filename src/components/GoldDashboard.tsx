'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card, Typography, Space, Row, Col, Grid, Alert, Statistic, Button, Drawer,
  Form, InputNumber, Input, DatePicker, App, Popconfirm,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { GoldOverview, GoldLot } from '@/lib/gold/report';
import { ResponsiveRows } from './ResponsiveRows';
import { PieChart, type Slice } from './PieChart';
import { StatCard, BreakdownLine, BreakdownNote, BreakdownStack } from './StatCard';
import { Pct } from './money';

const GREEN = '#237804';
const RED = '#a8071a';
const idr = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
const idr0 = (n: number) => (n < 0 ? '-' : '') + 'Rp ' + Math.round(Math.abs(n)).toLocaleString('id-ID');

const Money = ({ v }: { v: number }) => (
  <span style={{ fontVariantNumeric: 'tabular-nums', color: v < 0 ? RED : undefined }}>{idr0(v)}</span>
);

export function GoldDashboard({ accountId, data }: { accountId: string; data: GoldOverview }) {
  const screens = Grid.useBreakpoint();
  const small = !screens.lg;
  const { message } = App.useApp();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const pct = (v: number | null) => (v === null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`);

  async function add(v: { date: { format: (f: string) => string }; grams: number; total?: number; pricePerGram?: number; remarks?: string }) {
    setSaving(true);
    const res = await fetch(`/api/accounts/${accountId}/gold`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: v.date.format('YYYY-MM-DD'),
        grams: v.grams, total: v.total ?? null, pricePerGram: v.pricePerGram ?? null,
        remarks: v.remarks ?? '',
      }),
    });
    setSaving(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { message.error(body.error ?? 'Could not save.'); return; }
    message.success(`Added ${v.grams} g at ${idr(body.pricePerGram)} per gram.`);
    form.resetFields();
    setOpen(false);
    router.refresh();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/accounts/${accountId}/gold?tx=${id}`, { method: 'DELETE' });
    if (res.ok) { message.success('Purchase removed.'); router.refresh(); }
    else message.error('Could not remove it.');
  }

  const slices: Slice[] = data.byOwner.map((o) => ({
    label: o.owner, value: o.valueNow, note: `${o.grams.toFixed(2)} g`,
  }));

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Gold</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          {screens.sm ? 'Add purchase' : 'Add'}
        </Button>
      </div>

      {data.pricePerGram === null ? (
        <Alert type="warning" showIcon message="No gold price available"
          description="The price source could not be reached, so holdings cannot be valued right now." />
      ) : (
        <Card size={small ? 'small' : 'default'}>
          <Statistic title="Worth today" value={idr(data.valueNow)} valueStyle={{ fontSize: small ? 26 : 34 }} />
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {data.grams.toFixed(2)} g at {idr(data.pricePerGram)} per gram
          </Typography.Text>
          <div style={{ marginTop: 6 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              World spot price{data.priceFetchedAt && <>, checked {data.priceFetchedAt}</>}. Indonesian
              retail gold sells above spot and buys back below it, so a real sale would fetch less.
              {data.priceStale && ' Live price unavailable — showing the last one fetched.'}
            </Typography.Text>
          </div>
        </Card>
      )}

      <Row gutter={[12, 12]}>
        <Col xs={12} lg={6}>
          <StatCard small={small} title="Total money invested" value={idr(data.invested)}
            drawerTitle="What you paid"
            breakdown={
              <BreakdownStack>
                {data.byOwner.map((o) => (
                  <BreakdownLine key={o.owner} label={o.owner} note={`${o.grams.toFixed(2)} g`}
                    value={<Money v={o.invested} />} />
                ))}
                <BreakdownLine label="Total" value={<Money v={data.invested} />} strong divider />
              </BreakdownStack>
            } />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard small={small} title="Gold held" value={`${data.grams.toFixed(2)} g`} />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard small={small} title="Investment earned" value={idr0(data.gain)}
            valueColor={data.gain >= 0 ? GREEN : RED}
            drawerTitle="Gain by owner"
            breakdown={
              <BreakdownStack>
                {data.byOwner.map((o) => (
                  <BreakdownLine key={o.owner} label={o.owner}
                    note={`paid ${idr0(o.invested)}, worth ${idr0(o.valueNow)}`}
                    value={<Money v={o.gain} />} />
                ))}
                <BreakdownLine label="Total" value={<Money v={data.gain} />} strong divider />
              </BreakdownStack>
            } />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard small={small} title="Total return" value={pct(data.simpleReturn)}
            valueColor={(data.simpleReturn ?? 0) >= 0 ? GREEN : RED}
            drawerTitle="Total return"
            breakdown={
              <BreakdownStack>
                <BreakdownNote>
                  What your money grew by: everything it is worth now, against everything you put in.
                </BreakdownNote>
                <div style={{ marginTop: 16 }} />
                <BreakdownLine label="Money in" value={<Money v={data.invested} />} />
                <BreakdownLine label="Worth today" value={<Money v={data.valueNow} />} />
                <BreakdownLine label="Earned" value={<Money v={data.gain} />} strong divider />
              </BreakdownStack>
            } />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard small={small} title="Your money's rate (IRR)" value={pct(data.irr)}
            valueColor={(data.irr ?? 0) >= 0 ? GREEN : RED}
            drawerTitle="IRR"
            breakdown={
              <BreakdownStack>
                <BreakdownNote>
                  The one steady rate that would turn your actual purchases, on the dates you made
                  them, into today&apos;s value. It is the fairer figure here: the 2016 lot has had
                  ten years to grow and the 2026 one has had weeks.
                </BreakdownNote>
                <div style={{ marginTop: 16 }} />
                <BreakdownLine label="Your money's rate (IRR)" value={<Pct v={data.irr} bold />} />
                <BreakdownLine label="Total return" value={<Pct v={data.simpleReturn} />} />
                <BreakdownLine label="First purchase" value={data.firstPurchase ?? '—'} divider />
              </BreakdownStack>
            } />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard small={small} title="Purchases" value={String(data.lots.length)} />
        </Col>
      </Row>

      {slices.length > 0 && (
        <Card title="Whose gold" size={small ? 'small' : 'default'}>
          <PieChart slices={slices} centreValue={`${data.grams.toFixed(0)} g`} centreLabel="total" />
        </Card>
      )}

      <Card title="Purchases" styles={{ body: { padding: 0 } }} size={small ? 'small' : 'default'}>
        <ResponsiveRows<GoldLot & { key: string }>
          rows={data.lots.map((l) => ({ ...l, key: l.id }))}
          emptyText="No purchases yet."
          fields={[
            { key: 'date', label: 'Date', primary: true, render: (r) => r.date },
            { key: 'who', label: 'For', primary: true, render: (r) => r.remarks ?? '—' },
            { key: 'g', label: 'Grams', render: (r) => r.grams.toFixed(2) },
            { key: 'ppg', label: 'Price per gram', render: (r) => <Money v={r.pricePerGram} /> },
            { key: 'total', label: 'Total paid', render: (r) => <Money v={r.total} /> },
            { key: 'now', label: 'Worth now', render: (r) => <Money v={r.valueNow} /> },
            { key: 'gain', label: 'Gain', render: (r) => <Money v={r.gain} /> },
            { key: 'ret', label: 'Return', render: (r) => <Pct v={r.returnPct} bold /> },
            {
              key: 'del', label: '',
              render: (r) => (
                <Popconfirm title="Remove this purchase?" onConfirm={() => remove(r.id)} okText="Remove" cancelText="Keep">
                  <Button type="text" danger size="small">Remove</Button>
                </Popconfirm>
              ),
            },
          ]}
        />
      </Card>

      <Drawer
        title="Add a gold purchase"
        open={open}
        onClose={() => setOpen(false)}
        placement={screens.lg ? 'right' : 'bottom'}
        width={screens.lg ? 460 : undefined}
        height={screens.lg ? undefined : '85%'}
      >
        <Form form={form} layout="vertical" onFinish={add} requiredMark={false}>
          <Form.Item name="date" label="Date bought" rules={[{ required: true, message: 'Pick a date.' }]}>
            <DatePicker style={{ width: '100%' }} size="large" format="DD MMM YYYY" />
          </Form.Item>
          <Form.Item name="grams" label="Weight (grams)" rules={[{ required: true, message: 'How many grams?' }]}>
            <InputNumber style={{ width: '100%' }} size="large" min={0} step={0.01} />
          </Form.Item>
          <Form.Item name="total" label="Total paid (Rp)"
                     extra="Enter this OR the price per gram — whichever you have. The other is worked out.">
            <InputNumber style={{ width: '100%' }} size="large" min={0} step={100000}
              formatter={(v) => (v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '')}
              parser={(v) => Number((v ?? '').replace(/\./g, '')) as unknown as 0} />
          </Form.Item>
          <Form.Item name="pricePerGram" label="Price per gram (Rp)">
            <InputNumber style={{ width: '100%' }} size="large" min={0} step={1000}
              formatter={(v) => (v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '')}
              parser={(v) => Number((v ?? '').replace(/\./g, '')) as unknown as 0} />
          </Form.Item>
          <Form.Item name="remarks" label="For whom" extra="Free text — ANDRE, LISA, KIDS…">
            <Input size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={saving} block size="large">Add purchase</Button>
        </Form>
      </Drawer>
    </Space>
  );
}
