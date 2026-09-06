'use client';

import { SessionProvider } from 'next-auth/react';
import { ConfigProvider, App as AntdApp } from 'antd';
import { ledgerTheme } from '@lumilab/engine/lib/theme';
import '@/engine.client';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {/* AntdApp mounts the message/modal host. antd's STATIC helpers
          (message.success, Modal.confirm) silently no-op under React 19, so
          everything must go through App.useApp() — which needs this here. */}
      <ConfigProvider theme={ledgerTheme}>
        <AntdApp>{children}</AntdApp>
      </ConfigProvider>
    </SessionProvider>
  );
}
