'use client';
import { Table, Tag, Card, Typography, Space } from 'antd';

export interface UserRow { key: string; email: string; nickname: string | null; isAdmin: boolean; createdAt: string }

export function UsersTable({ rows }: { rows: UserRow[] }) {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>Users</Typography.Title>
      <Card styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={rows}
          pagination={false}
          scroll={{ x: true }}
          columns={[
            { title: 'Email', dataIndex: 'email' },
            { title: 'Name', dataIndex: 'nickname' },
            { title: 'Role', dataIndex: 'isAdmin', render: (v: boolean) => (v ? <Tag color="blue">Admin</Tag> : <Tag>User</Tag>) },
            { title: 'Created', dataIndex: 'createdAt' },
          ]}
        />
      </Card>
    </Space>
  );
}
