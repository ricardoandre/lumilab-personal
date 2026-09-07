'use client';

import { Refine } from '@refinedev/core';
import routerProvider from '@refinedev/nextjs-router/app';
import { dataProvider } from '@lumilab/engine/lib/data-provider';
import { authProvider } from '@lumilab/engine/lib/auth-provider';
import { createResourceListView } from '@lumilab/engine/ui';
import { goldPurchaseResource } from '@/lib/resources/gold-purchase';

// Built once at module scope: createResourceListView makes a NEW component from
// the config, so building it inside render would remount the list on every
// keystroke and lose page, scroll and selection.
const GoldPurchasesView = createResourceListView(goldPurchaseResource);

/**
 * The account's own Refine scope. The protected layout already provides one for
 * the app's resources; this adds `gold-purchases` so the engine's list can
 * resolve its routes and data provider without every account page having to
 * declare a resource it does not use.
 */
export function GoldPurchasesList() {
  return (
    <Refine
      routerProvider={routerProvider}
      dataProvider={dataProvider}
      authProvider={authProvider}
      resources={[{ name: 'gold-purchases', list: '/gold-purchases', meta: { label: 'Gold purchases' } }]}
      options={{ syncWithLocation: false, disableTelemetry: true }}
    >
      <GoldPurchasesView />
    </Refine>
  );
}
