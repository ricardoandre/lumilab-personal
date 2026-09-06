import { NextResponse } from 'next/server';
import '@/engine.server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { importStatement } from '@/lib/gotrade/import-statement';

export const maxDuration = 120;

/**
 * Upload one or more Gotrade statement PDFs.
 *
 * Accepts many files in one request on purpose: Andre has four years of monthly
 * statements, so "one file at a time" would mean 45 uploads. Each file is
 * imported independently and reports its own outcome — a single bad statement
 * must not abandon the other 44.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  let accountId: bigint;
  try { accountId = BigInt(id); } catch { return NextResponse.json({ error: 'Bad account' }, { status: 400 }); }

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return NextResponse.json({ error: 'No such account' }, { status: 404 });

  const form = await req.formData();
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });

  const { PDFParse } = await import('pdf-parse');
  const results = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      let text = '';
      try { text = (await parser.getText()).text; } finally { await parser.destroy(); }

      const r = await importStatement(prisma, { accountId, fileName: file.name, buffer, text });

      // The statement names its own account number. Importing one shop's
      // statement into another account would corrupt both silently, so refuse.
      results.push({ fileName: file.name, ...r });
    } catch (e) {
      results.push({
        fileName: file.name, status: 'failed' as const, periodLabel: null, reconciled: false,
        rowsParsed: 0, rowsInserted: 0, rowsSkipped: 0, holdings: 0,
        error: e instanceof Error ? e.message : 'Could not read this PDF.',
      });
    }
  }

  return NextResponse.json({
    results,
    summary: {
      imported: results.filter((r) => r.status === 'ok').length,
      duplicates: results.filter((r) => r.status === 'duplicate').length,
      failed: results.filter((r) => r.status === 'failed').length,
      transactions: results.reduce((a, r) => a + r.rowsInserted, 0),
    },
  });
}
