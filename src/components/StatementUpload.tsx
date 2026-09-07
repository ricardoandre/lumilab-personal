'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Button, Typography, Space, Tag, Alert, App } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';

interface Result {
  fileName: string; status: 'ok' | 'duplicate' | 'failed';
  periodLabel: string | null; rowsInserted: number; holdings: number; error?: string;
}

export function StatementUpload({ accountId, provider, onDone }: { accountId: string; provider?: string; onDone?: () => void }) {
  const { message } = App.useApp();
  const router = useRouter();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);

  async function upload() {
    if (!files.length) return;
    setBusy(true);
    setResults(null);
    const fd = new FormData();
    for (const f of files) if (f.originFileObj) fd.append('files', f.originFileObj);

    try {
      const res = await fetch(`/api/accounts/${accountId}/import`, { method: 'POST', body: fd });
      const body = await res.json();
      if (!res.ok) { message.error(body.error ?? 'Upload failed.'); return; }
      setResults(body.results);
      const s = body.summary;
      message.success(`${s.imported} imported, ${s.duplicates} already had, ${s.failed} failed.`);
      setFiles([]);
      router.refresh(); // the page's own figures are now stale
      onDone?.();
    } catch {
      message.error('Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          Drop your {provider ?? 'monthly'} statement PDFs here — as many at once as you like.
          Uploading the same month twice is safe: it is recognised and skipped.
        </Typography.Paragraph>

        <Upload.Dragger
          multiple
          accept=".pdf"
          fileList={files}
          beforeUpload={() => false}
          onChange={({ fileList }) => setFiles(fileList)}
          onRemove={(f) => setFiles((prev) => prev.filter((x) => x.uid !== f.uid))}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">Tap to choose files, or drop them here</p>
          <p className="ant-upload-hint">PDF statements only</p>
        </Upload.Dragger>

        <Button type="primary" onClick={upload} loading={busy} disabled={!files.length} block>
          {busy ? 'Reading statements…' : `Import ${files.length || ''} statement${files.length === 1 ? '' : 's'}`}
        </Button>

        {results && (
          <Space direction="vertical" size={6} style={{ width: '100%' }}>
            {results.map((r) => (
              <div key={r.fileName} style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <Tag color={r.status === 'ok' ? 'green' : r.status === 'duplicate' ? 'default' : 'red'}>
                  {r.status === 'ok' ? 'imported' : r.status === 'duplicate' ? 'already had' : 'failed'}
                </Tag>
                <span style={{ fontSize: 13 }}>{r.periodLabel ?? r.fileName}</span>
                {r.status === 'ok' && (
                  <span style={{ fontSize: 12, color: '#726c63' }}>+{r.rowsInserted} transactions, {r.holdings} holdings</span>
                )}
                {r.error && <span style={{ fontSize: 12, color: '#a8071a' }}>{r.error}</span>}
              </div>
            ))}
            {results.some((r) => r.status === 'failed') && (
              <Alert
                type="warning"
                showIcon
                message="Some statements did not balance"
                description="Their figures were not saved. A statement is only imported when its transactions add up to the totals the broker printed — otherwise the numbers cannot be trusted."
              />
            )}
          </Space>
        )}
      </Space>
    </>
  );
}
