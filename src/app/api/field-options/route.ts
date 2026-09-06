import { NextResponse } from 'next/server';
import '@/engine.server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// The engine's field-options-cache reads dropdown values from here by a FIXED
// path, so every app must expose it or every select renders empty.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const fieldKey = new URL(req.url).searchParams.get('fieldKey') ?? undefined;
  const rows = await prisma.fieldOption.findMany({
    where: { isActive: true, ...(fieldKey ? { fieldKey } : {}) },
    orderBy: [{ fieldKey: 'asc' }, { sortOrder: 'asc' }],
  });
  return NextResponse.json({
    data: rows.map((o) => ({
      id: String(o.id), fieldKey: o.fieldKey, value: o.value,
      label: o.label, color: o.color, sortOrder: o.sortOrder,
    })),
    total: rows.length,
  });
}
