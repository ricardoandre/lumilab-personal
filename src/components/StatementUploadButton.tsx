'use client';

import { useState } from 'react';
import { Button, Drawer, Grid } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { StatementUpload } from './StatementUpload';

/**
 * Upload lives behind a top-right button, not as a permanent card.
 *
 * Uploading is occasional — once a month — while reading the numbers is the
 * daily job. A drawer keeps the action reachable without spending the top of a
 * phone screen on it.
 */
export function StatementUploadButton({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);
  const screens = Grid.useBreakpoint();
  return (
    <>
      <Button icon={<UploadOutlined />} onClick={() => setOpen(true)}>
        {screens.sm ? 'Upload statements' : 'Upload'}
      </Button>
      <Drawer
        title="Upload statements"
        open={open}
        onClose={() => setOpen(false)}
        width={screens.lg ? 520 : '100%'}
        height={screens.lg ? undefined : '85%'}
        placement={screens.lg ? 'right' : 'bottom'}
        destroyOnHidden={false}
      >
        <StatementUpload accountId={accountId} onDone={() => undefined} />
      </Drawer>
    </>
  );
}
