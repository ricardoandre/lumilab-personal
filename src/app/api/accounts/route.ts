import { NextResponse } from 'next/server';
import '@/engine.server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? '').trim();
  const provider = String(body.provider ?? '').trim();
  const kind = String(body.kind ?? '').trim();
  const currency = String(body.currency ?? '').trim().toUpperCase();

  if (!name) return NextResponse.json({ error: 'Give the account a name.' }, { status: 400 });
  if (!provider) return NextResponse.json({ error: 'Choose a provider.' }, { status: 400 });
  if (!['BANK', 'BROKERAGE'].includes(kind)) return NextResponse.json({ error: 'Choose a type.' }, { status: 400 });
  if (!/^[A-Z]{3}$/.test(currency)) return NextResponse.json({ error: 'Currency should be three letters, e.g. USD.' }, { status: 400 });

  const option = await prisma.fieldOption.findUnique({
    where: { fieldKey_value: { fieldKey: 'account.provider', value: provider } },
  });
  if (!option) return NextResponse.json({ error: 'Unknown provider.' }, { status: 400 });

  if (await prisma.account.findFirst({ where: { name } })) {
    return NextResponse.json({ error: 'An account with that name already exists.' }, { status: 400 });
  }

  // Sits at the end of the menu; order is adjustable later.
  const last = await prisma.account.findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });

  const account = await prisma.account.create({
    data: {
      name, providerId: option.id, kind, currency,
      sortOrder: (last?.sortOrder ?? 0) + 10,
      // Left null on purpose: the first statement uploaded claims the broker's
      // account number, which is then used to route later uploads.
    },
  });
  return NextResponse.json({ id: String(account.id), name: account.name });
}
