import fs from 'node:fs';
import path from 'node:path';
import { parseStatement, reconcile } from '../src/lib/gotrade/parse-statement.ts';

const DIR = process.argv[2];
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (e.name.toLowerCase().endsWith('.pdf')) files.push(p);
  }
})(DIR);
files.sort();

const { PDFParse } = await import('pdf-parse');
let pass = 0; const fails = [];
let tx = 0, hold = 0;
for (const f of files) {
  const p = new PDFParse({ data: new Uint8Array(fs.readFileSync(f)) });
  let text = ''; try { text = (await p.getText()).text; } finally { await p.destroy(); }
  const s = parseStatement(text);
  const r = reconcile(s);
  tx += s.transactions.length; hold += s.holdings.length;
  if (r.ok) pass++;
  else fails.push({ f: path.relative(DIR, f), period: s.periodLabel, checks: r.checks.filter((c) => !c.ok), notes: r.notes });
}
console.log(`statements   : ${files.length}`);
console.log(`reconciled   : ${pass}/${files.length}`);
console.log(`transactions : ${tx}`);
console.log(`holdings     : ${hold}`);
if (fails.length) {
  console.log(`\nFAILURES (${fails.length}):`);
  for (const x of fails.slice(0, 12)) {
    console.log(`  ${x.f} (${x.period})`);
    for (const c of x.checks) console.log(`      ${c.name}: expected ${c.expected} got ${c.actual}`);
    for (const n of x.notes) console.log(`      note: ${n}`);
  }
}
