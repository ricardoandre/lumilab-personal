import '@/engine.server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/require-user';
import { FieldOptionsTable, type FieldOptionRow } from '@/components/FieldOptionsTable';

export const dynamic = 'force-dynamic';

export default async function FieldOptionsPage() {
  await requireUser();
  const opts = await prisma.fieldOption.findMany({ orderBy: [{ fieldKey: 'asc' }, { sortOrder: 'asc' }] });
  const rows: FieldOptionRow[] = opts.map((o) => ({
    key: String(o.id), fieldKey: o.fieldKey, value: o.value, label: o.label,
    color: o.color, sortOrder: o.sortOrder, isActive: o.isActive,
  }));
  return <FieldOptionsTable rows={rows} />;
}
