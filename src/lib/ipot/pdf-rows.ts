/**
 * Read a PDF as VISUAL rows, not as a stream of text.
 *
 * IPOT's statements have no ruled table, and plain text extraction returns the
 * numbers and their descriptions in two separate blocks — 20 numeric rows
 * against 27 description lines, drifting apart from the fifth entry. Zipping
 * them by position silently mislabels every row after the first partial fill.
 *
 * Grouping text items by their Y coordinate and sorting by X reconstructs what
 * the page actually looks like, which is the only reliable reading.
 */
export interface PdfRow {
  page: number;
  y: number;
  cells: string[];
}

export async function pdfRows(data: Buffer): Promise<PdfRow[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data), useSystemFonts: true }).promise;
  const out: PdfRow[] = [];

  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const byY = new Map<number, { x: number; s: string }[]>();

      for (const item of content.items as { str: string; transform: number[] }[]) {
        if (!item.str.trim()) continue;
        // Round to the nearest point: the same visual row can differ by a
        // fraction when fonts change mid-line.
        const y = Math.round(item.transform[5]);
        if (!byY.has(y)) byY.set(y, []);
        byY.get(y)!.push({ x: item.transform[4], s: item.str });
      }

      for (const [y, items] of [...byY.entries()].sort((a, b) => b[0] - a[0])) {
        const cells = items.sort((a, b) => a.x - b.x).map((i) => i.s.trim()).filter(Boolean);
        if (cells.length) out.push({ page: n, y, cells });
      }
    }
  } finally {
    await doc.destroy();
  }
  return out;
}

/** "1,442,542" | "-19,136,290" | "0" -> number, or null when not a number. */
export function num(s: string | undefined): number | null {
  if (s == null) return null;
  const t = s.replace(/[,\s]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  const v = parseFloat(t);
  return Number.isFinite(v) ? v : null;
}

/** "01-Apr-22" -> "2022-04-01" */
export function idDate(s: string | undefined): string | null {
  const m = String(s ?? '').match(/^(\d{2})-([A-Za-z]{3})-(\d{2})$/);
  if (!m) return null;
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const mm = months[m[2].toLowerCase()];
  if (!mm) return null;
  // Two-digit years in these statements are all 2000s.
  return `20${m[3]}-${mm}-${m[1]}`;
}
