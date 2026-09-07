import type { ResourceConfig } from '@lumilab/engine/lib/resource-config';

const idr = (n: unknown) =>
  n == null ? '' : 'Rp ' + Math.round(Math.abs(Number(n))).toLocaleString('id-ID');

/**
 * Gold purchases, driven by the shared ListEngine rather than a hand-written
 * table — the same config-driven CRUD kanoapp uses, so search, sort, the detail
 * drawer and the create/edit form all come for free and behave identically.
 *
 * `netAmount` is stored negative (money leaving) but shown and entered positive:
 * asking someone to type "-24760000" for a purchase would be a leaky abstraction.
 * The API's beforeWrite applies the sign.
 */
export const goldPurchaseResource: ResourceConfig = {
  name: 'gold-purchases',
  label: 'Gold purchases',
  viewMode: 'table',
  fields: [
    { name: 'tradeDate', label: 'Date bought', type: 'date', required: true },
    { name: 'description', label: 'For whom', type: 'text' },
    { name: 'quantity', label: 'Grams', type: 'number', required: true },
    {
      name: 'price', label: 'Price per gram', type: 'number',
      // Derived from total ÷ grams on save, so it is kept OUT of the form rather
      // than offered as a second number that can disagree with the first.
      showInForm: false,
      render: (row: any) => idr(row.price),
    },
    {
      name: 'netAmount', label: 'Total paid', type: 'number', required: true,
      render: (row: any) => idr(row.netAmount),
    },
  ],
  sortFields: [
    { name: 'tradeDate', label: 'Date bought', order: 'desc' },
    { name: 'netAmount', label: 'Total paid' },
    { name: 'quantity', label: 'Grams' },
  ],
};
