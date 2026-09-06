'use client';
import { Card, Typography, Space, Descriptions, Empty, Tag } from 'antd';

export interface AccountDetail {
  name: string; provider: string; color: string | null; kind: string; currency: string;
  accountNo: string | null; imports: number; transactions: number;
}

export function AccountDetailView({ account }: { account: AccountDetail }) {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>{account.name}</Typography.Title>
      <Card>
        <Descriptions column={{ xs: 1, sm: 2 }} size="small">
          <Descriptions.Item label="Provider"><Tag color={account.color ?? undefined}>{account.provider}</Tag></Descriptions.Item>
          <Descriptions.Item label="Type">{account.kind}</Descriptions.Item>
          <Descriptions.Item label="Currency">{account.currency}</Descriptions.Item>
          <Descriptions.Item label="Account no.">{account.accountNo ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Statements">{account.imports}</Descriptions.Item>
          <Descriptions.Item label="Transactions">{account.transactions}</Descriptions.Item>
        </Descriptions>
      </Card>
      {account.transactions === 0 && (
        <Card><Empty description="No statements imported for this account yet." /></Card>
      )}
    </Space>
  );
}
