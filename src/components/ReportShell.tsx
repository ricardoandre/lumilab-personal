'use client';
import { Typography, Space } from 'antd';
import { ReportTabs } from './ReportTabs';
import { StatementUploadButton } from './StatementUploadButton';
import { DataHealthAlert } from './DataHealthAlert';
import { CurrencyProvider } from './money';

export function ReportShell({
  accountId, accountName, currency, missing, failed, asAt, children,
}: {
  accountId: string; accountName: string; currency: string;
  missing: string[]; failed: { fileName: string; reason: string }[];
  asAt: { period: string; monthsBehind: number } | null;
  children: React.ReactNode;
}) {
  return (
    <CurrencyProvider value={currency}>
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>{accountName} — Report</Typography.Title>
        <StatementUploadButton accountId={accountId} />
      </div>
      <ReportTabs accountId={accountId} />
      <DataHealthAlert missing={missing} failed={failed} asAt={asAt} />
      {children}
    </Space>
    </CurrencyProvider>
  );
}
