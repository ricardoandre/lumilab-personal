/**
 * Drive the real screens in headless Chrome.
 *
 * Exists because status codes lie. Both screens answered 200 while React was
 * throwing "Element type is invalid" and refusing to render — a curl sweep
 * called that healthy. Same lesson as kanoapp's browser-check, applied here from
 * the start rather than after an outage.
 *
 * Speaks CDP over Node's built-in WebSocket; no npm dependency.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3004';
// Credentials come from the environment. They were hardcoded to Andre's, and
// when he changed his own password every screen reported FAIL — the app was
// fine, the check was stale. A failed sign-in now says so explicitly instead of
// cascading into twenty misleading failures.
const EMAIL = process.env.CHECK_EMAIL || 'lisa.kumala.iskandar@gmail.com';
const PASSWORD = process.env.CHECK_PASSWORD || 'Password1234';
const CHROME = process.env.CHROME_PATH
  || '/home/claudeuser/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';

if (!fs.existsSync(CHROME)) { console.error('chrome not found at ' + CHROME); process.exit(2); }

const port = 9400 + Math.floor(Math.random() * 200);
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${port}`, '--no-sandbox',
  '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function endpoint() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('chrome never came up');
}

const wsUrl = await endpoint();
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
const events = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  else if (msg.method) events.push(msg);
};
const send = (method, params = {}, sessionId) =>
  new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });

const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Log.enable', {}, sessionId);
await send('Network.enable', {}, sessionId);

const errors = [];
const origOnMessage = ws.onmessage;
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.method === 'Runtime.exceptionThrown')
    errors.push(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text || 'exception');
  if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error')
    errors.push('console: ' + msg.params.entry.text + (msg.params.entry.url ? ' <' + msg.params.entry.url + '>' : ''));
  // A failing request must name itself. "Failed to load resource: 404" with no
  // URL is unactionable, and chasing it by guessing cost a round trip already.
  if (msg.method === 'Network.responseReceived' && msg.params.response.status >= 400)
    errors.push(`http ${msg.params.response.status} ${msg.params.response.url}`);
  origOnMessage(m);
};

async function goto(url) {
  errors.length = 0;
  await send('Page.navigate', { url }, sessionId);
  await sleep(2500);
}
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
  return r.result?.result?.value;
}

let failed = false;
const report = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failed = true;
};

// 1. login
await goto(`${BASE}/login`);
report('login page renders', await evaluate(`!!document.querySelector('input[type=email]')`));
await evaluate(`(() => {
  const set = (el, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  set(document.querySelector('input[type=email]'), ${JSON.stringify(EMAIL)});
  set(document.querySelector('input[type=password]'), ${JSON.stringify(PASSWORD)});
  document.querySelector('button[type=submit]').click();
})()`);
await sleep(5000);
const signedIn = !(await evaluate(`location.pathname`)).startsWith('/login');
report('signed in (left /login)', signedIn, signedIn ? '' : `credentials rejected for ${EMAIL} — set CHECK_EMAIL / CHECK_PASSWORD`);
if (!signedIn) {
  console.log('\n  Sign-in failed, so every screen below would fail for that reason alone. Stopping.');
  ws.close(); chrome.kill();
  console.log('\nRESULT: FAIL');
  process.exit(1);
}

// 2. the screens
for (const [name, path, expect] of [
  ['dashboard', '/', 'Overview'],
  ['accounts', '/accounts', 'Andre Gotrade'],
  ['account dashboard', '/accounts/1', 'Full report'],
  ['my account', '/account', 'Change password'],
  ['users', '/users', 'ricardo.4ndre@gmail.com'],
  ['field options', '/field-options', 'Gotrade'],
  ['overview report', '/accounts/1/report', 'Year by year'],
  ['stocks report', '/accounts/1/report/stocks', 'Return a year'],
  ['transactions', '/accounts/1/report/transactions', 'DEPOSIT'.toLowerCase()],
  ['upload button', '/accounts/1', 'Upload'],
  ['missing-statement warning', '/accounts/1', 'missing'],
]) {
  await goto(BASE + path);
  const text = await evaluate(`document.body.innerText`);
  report(`${name}: content`, (text || '').includes(expect), `expected "${expect}"`);
  report(`${name}: sidebar`, await evaluate(`!!document.querySelector('.ant-layout-sider, .ant-menu')`));
  report(`${name}: no uncaught errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
}

if (process.env.PEEK) {
  await goto(BASE + '/accounts');
  console.log('\n--- SIDEBAR TEXT ---');
  console.log(await evaluate(`(document.querySelector('.ant-layout-sider')?.innerText || 'no sider')`));
  console.log('\n--- HEADER TEXT ---');
  console.log(await evaluate(`(document.querySelector('.ant-layout-header')?.innerText || 'no header')`));
}
ws.close(); chrome.kill();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: ALL CLEAR');
process.exit(failed ? 1 : 0);
