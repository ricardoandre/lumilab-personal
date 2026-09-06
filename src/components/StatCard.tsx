'use client';

import { useState } from 'react';
import { Card, Statistic, Drawer, Grid, Typography, Space } from 'antd';
import { RightOutlined } from '@ant-design/icons';

/**
 * A figure that can be opened to see where it came from.
 *
 * A single number invites "made of what?", and the honest answer is a breakdown,
 * not a footnote. Clicking opens a drawer — a bottom sheet on a phone, a side
 * panel on desktop. Cards with no `breakdown` stay inert and show no affordance,
 * so the chevron always means something is there.
 */
export function StatCard({
  title, value, valueColor, small, breakdown, drawerTitle,
}: {
  title: string;
  value: string;
  valueColor?: string;
  small?: boolean;
  breakdown?: React.ReactNode;
  drawerTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const screens = Grid.useBreakpoint();
  const clickable = !!breakdown;

  return (
    <>
      <Card
        size={small ? 'small' : 'default'}
        hoverable={clickable}
        onClick={clickable ? () => setOpen(true) : undefined}
        style={clickable ? { cursor: 'pointer' } : undefined}
        styles={{ body: { position: 'relative' } }}
      >
        <Statistic title={title} value={value} valueStyle={valueColor ? { color: valueColor } : undefined} />
        {clickable && (
          <RightOutlined style={{ position: 'absolute', top: 12, right: 12, fontSize: 11, color: '#b0a89c' }} />
        )}
      </Card>
      {clickable && (
        <Drawer
          title={drawerTitle ?? title}
          open={open}
          onClose={() => setOpen(false)}
          placement={screens.lg ? 'right' : 'bottom'}
          width={screens.lg ? 520 : undefined}
          height={screens.lg ? undefined : '80%'}
        >
          {breakdown}
        </Drawer>
      )}
    </>
  );
}

/** Label/value line used inside the breakdown drawers. */
export function BreakdownLine({
  label, value, note, strong, divider,
}: { label: React.ReactNode; value: React.ReactNode; note?: string; strong?: boolean; divider?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline',
      padding: '8px 0', borderTop: divider ? '1px solid #e7e2d9' : undefined,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: strong ? 600 : 400 }}>{label}</div>
        {note && <div style={{ fontSize: 12, color: '#726c63' }}>{note}</div>}
      </div>
      <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: strong ? 600 : 400, whiteSpace: 'nowrap' }}>
        {value}
      </div>
    </div>
  );
}

export function BreakdownNote({ children }: { children: React.ReactNode }) {
  return (
    <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 16, marginBottom: 0 }}>
      {children}
    </Typography.Paragraph>
  );
}

export const BreakdownStack = ({ children }: { children: React.ReactNode }) => (
  <Space direction="vertical" size={0} style={{ width: '100%' }}>{children}</Space>
);
