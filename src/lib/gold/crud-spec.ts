import crypto from 'node:crypto';
import type { CrudSpec } from '@lumilab/engine/server';
import { prisma } from '@/lib/prisma';

/** The gold account and its security, resolved once and cached for the process. */
let cached: { accountId: bigint; securityId: bigint } | null = null;
export async function goldIds() {
  if (cached) return cached;
  const account = await prisma.account.findFirst({ where: { kind: 'COMMODITY' }, orderBy: { id: 'asc' } });
  const security = await prisma.security.findFirst({ where: { symbol: 'GOLD' } });
  if (!account || !security) throw new Error('Gold account or security missing');
  cached = { accountId: account.id, securityId: security.id };
  return cached;
}

/**
 * Gold purchases as a CRUD resource over the shared Transaction table.
 *
 * `baseWhere` is what makes that safe — this resource is a SLICE (one account,
 * type BUY), and without it the list would show every trade in the app and the
 * by-id routes would edit them.
 *
 * `beforeWrite` supplies the three things a form should not have to know: the
 * account and security ids, the required dedupe key, and the sign convention
 * (money leaving is negative, so a purchase is stored as a negative amount while
 * the form shows a positive one).
 */
export function goldCrudSpec(ids: { accountId: bigint; securityId: bigint }): CrudSpec {
  return {
    model: 'transaction',
    baseWhere: { accountId: ids.accountId, type: 'BUY' },
    fields: [
      { name: 'tradeDate', kind: 'date' },
      { name: 'quantity', kind: 'float' },
      { name: 'price', kind: 'float' },
      { name: 'netAmount', kind: 'float' },
      { name: 'description', kind: 'string' },
    ],
    searchFields: ['description'],
    defaultOrderBy: { tradeDate: 'desc' },
    beforeWrite: (data, body, mode) => {
      const grams = Number(body.quantity);
      // The form may give a total OR a price per gram; the other is derived, so
      // whichever the user has to hand is the one they can type.
      const total = body.netAmount != null && body.netAmount !== ''
        ? Math.abs(Number(body.netAmount))
        : grams * Number(body.price);
      const pricePerGram = grams > 0 ? Math.round((total / grams) * 100) / 100 : 0;

      const shaped: Record<string, unknown> = {
        ...data,
        quantity: grams,
        price: pricePerGram,
        netAmount: -Math.abs(total),
        currency: 'IDR',
      };
      if (mode === 'create') {
        shaped.accountId = ids.accountId;
        shaped.securityId = ids.securityId;
        shaped.type = 'BUY';
        shaped.dedupeKey = crypto.randomUUID();
      }
      return shaped;
    },
  };
}
