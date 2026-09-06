'use client';

import { Table, Card, Grid, Space, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';

export interface RowField<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  /** Shown in the card header line rather than the field list. */
  primary?: boolean;
  /** Hidden on phones — detail that does not earn its vertical space. */
  hideOnMobile?: boolean;
}

/**
 * One data set, two presentations.
 *
 * Andre reads this on a phone. A seven-column financial table on a 390px screen
 * is a horizontal scrollbar hiding the numbers you came for, so below `lg` each
 * row becomes a card with its figures stacked as label/value pairs. Above it,
 * the ordinary table, which is genuinely better with a mouse.
 *
 * Deliberately ONE definition of the fields: keeping a separate mobile table in
 * sync by hand is how the two drift apart.
 */
export function ResponsiveRows<T extends { key: string }>({
  rows, fields, emptyText = 'Nothing to show yet.',
}: { rows: T[]; fields: RowField<T>[]; emptyText?: string }) {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;

  if (!rows.length) {
    return <div style={{ padding: 24 }}><Typography.Text type="secondary">{emptyText}</Typography.Text></div>;
  }

  if (!isMobile) {
    const columns: ColumnsType<T> = fields.map((f) => ({
      title: f.label,
      key: f.key,
      align: f.primary ? 'left' : 'right',
      render: (_: unknown, row: T) => f.render(row),
    }));
    return <Table<T> dataSource={rows} columns={columns} pagination={false} scroll={{ x: true }} size="middle" />;
  }

  const primary = fields.filter((f) => f.primary);
  const rest = fields.filter((f) => !f.primary && !f.hideOnMobile);

  return (
    <Space direction="vertical" size={10} style={{ width: '100%', padding: 12 }}>
      {rows.map((row) => (
        <Card key={row.key} size="small" styles={{ body: { padding: 12 } }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 8 }}>
            {primary.map((f) => (
              <span key={f.key} style={{ fontWeight: 600, fontSize: 15 }}>{f.render(row)}</span>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 4, columnGap: 12 }}>
            {rest.map((f) => (
              <FieldLine key={f.key} label={f.label} value={f.render(row)} />
            ))}
          </div>
        </Card>
      ))}
    </Space>
  );
}

function FieldLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <span style={{ color: '#726c63', fontSize: 13 }}>{label}</span>
      <span style={{ fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </>
  );
}
