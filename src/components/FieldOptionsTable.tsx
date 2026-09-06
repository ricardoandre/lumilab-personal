'use client';
import { Table, Tag, Card, Typography, Space } from 'antd';

export interface FieldOptionRow {
  key: string; fieldKey: string; value: string; label: string; color: string | null; sortOrder: number; isActive: boolean;
}

export function FieldOptionsTable({ rows }: { rows: FieldOptionRow[] }) {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>Field Options</Typography.Title>
      <Card styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={rows}
          pagination={false}
          scroll={{ x: true }}
          columns={[
            { title: 'Field', dataIndex: 'fieldKey' },
            { title: 'Value', dataIndex: 'value' },
            { title: 'Label', dataIndex: 'label', render: (v: string, r: FieldOptionRow) => <Tag color={r.color ?? undefined}>{v}</Tag> },
            { title: 'Order', dataIndex: 'sortOrder' },
            { title: 'Active', dataIndex: 'isActive', render: (v: boolean) => (v ? 'Yes' : 'No') },
          ]}
        />
      </Card>
    </Space>
  );
}
