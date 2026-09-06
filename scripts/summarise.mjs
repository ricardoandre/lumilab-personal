import fs from 'node:fs';
import path from 'node:path';
import { parseStatement } from '../src/lib/gotrade/parse-statement.ts';

const DIR = process.argv[2];
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, e.name);
  if (e.isDirectory()) walk(p); else if (e.name.toLowerCase().endsWith('.pdf')) files.push(p);
} })(DIR);
files.sort();

const { PDFParse } = await import('pdf-parse');
const seen = new Set(); const byType = {}; let latest = null;
const r2 = (n) => Math.round(n * 100) / 100;

for (const f of files) {
  const p = new PDFParse({ data: new Uint8Array(fs.readFileSync(f)) });
  let text = ''; try { text = (await p.getText()).text; } finally { await p.destroy(); }
  const s = parseStatement(text);
  // the duplicate 202401(1).pdf must not be counted twice
  const key = `${s.accountNo}|${s.periodLabel}`;
  if (seen.has(key)) { console.log(`  skipped duplicate period: ${path.relative(DIR, f)} (${s.periodLabel})`); continue; }
  seen.add(key);
  for (const t of s.transactions) {
    byType[t.type] ??= { n: 0, total: 0 };
    byType[t.type].n++; byType[t.type].total = r2(byType[t.type].total + t.amount);
  }
  if (!latest || (s.periodEnd ?? '') > (latest.periodEnd ?? '')) latest = s;
}

console.log(`\nunique statement periods: ${seen.size}\n`);
console.log('by transaction type:');
for (const [k, v] of Object.entries(byType).sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total)))
  console.log(`  ${k.padEnd(12)} ${String(v.n).padStart(3)} rows   ${v.total >= 0 ? ' ' : ''}$${v.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);

console.log(`\nlatest statement: ${latest.periodLabel}  (cash $${latest.cash.ending})`);
console.log('holdings:');
for (const h of latest.holdings)
  console.log(`  ${h.symbol.padEnd(7)} qty ${String(h.quantity).padStart(7)}  @ $${String(h.marketPrice).padStart(8)}  value $${String(h.marketValue).padStart(10)}  cost $${String(h.costBasis).padStart(9)}  unreal $${h.unrealized}`);
