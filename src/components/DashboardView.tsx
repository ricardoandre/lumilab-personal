'use client';

import Link from 'next/link';
import { Card, Typography, Space, Statistic, Row, Col } from 'antd';

/**
 * Client component because antd's compound components (Typography.Title,
 * Card.Meta) are UNDEFINED inside a Server Component: antd has no 'use client',
 * so from RSC the module is a client-reference proxy and property access on it
 * does not resolve. The page stays a server component and does the querying;
 * rendering happens here.
 */
export function DashboardView({ accounts, imports, txs }: { accounts: number; imports: number; txs: number }) {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>Overview</Typography.Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}><Card><Statistic title="Accounts" value={accounts} /></Card></Col>
        <Col xs={24} sm={8}><Card><Statistic title="Statements imported" value={imports} /></Card></Col>
        <Col xs={24} sm={8}><Card><Statistic title="Transactions" value={txs} /></Card></Col>
      </Row>
      <Card>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          No statements imported yet. Start from <Link href="/accounts">Accounts</Link>.
        </Typography.Paragraph>
      </Card>
    </Space>
  );
}
