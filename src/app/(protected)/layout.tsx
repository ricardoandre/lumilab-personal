'use client';
import { Suspense } from 'react';
import { Refine } from '@refinedev/core';
import { ThemedLayout } from '@refinedev/antd';
import routerProvider from '@refinedev/nextjs-router/app';
import { Spin } from 'antd';
import { dataProvider } from '@lumilab/engine/lib/data-provider';
import { authProvider } from '@lumilab/engine/lib/auth-provider';
import { AppHeader, AppTitle, AppSider } from '@lumilab/engine/ui';
import { useAppNotificationProvider } from '@lumilab/engine/ui/notification-provider';
import { EntityDrawerHost } from '@lumilab/engine/ui/EntityDrawerHost';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Spin fullscreen />}>
      <Refine
        routerProvider={routerProvider}
        dataProvider={dataProvider}
        authProvider={authProvider}
        notificationProvider={useAppNotificationProvider}
        resources={[{ name: 'accounts', list: '/accounts', meta: { label: 'Accounts' } }]}
        options={{ syncWithLocation: true, disableTelemetry: true }}
      >
        <ThemedLayout Header={AppHeader} Title={AppTitle} Sider={AppSider}>{children}</ThemedLayout>
        <EntityDrawerHost />
      </Refine>
    </Suspense>
  );
}
