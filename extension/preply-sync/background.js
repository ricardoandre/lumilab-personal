importScripts('config.js'); // defines SYNC_URL and SYNC_TOKEN, written by the download

const EVERY_HOURS = 6;

async function post(text, url, tabId) {
  let result;
  try {
    const res = await fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + SYNC_TOKEN },
      body: JSON.stringify({ text, url }),
    });
    result = res.ok ? await res.json() : { error: 'HTTP ' + res.status };
  } catch (e) {
    result = { error: String(e) };
  }
  const saved = { lastSync: { at: Date.now(), url, result } };
  // Remember the conversation that holds words, so the timed sync can reopen it.
  if (result && result.lessons > 0) saved.chatUrl = url;
  await chrome.storage.local.set(saved);
  if (result && result.newWords > 0) {
    chrome.action.setBadgeBackgroundColor({ color: '#389e0d' });
    chrome.action.setBadgeText({ text: String(result.newWords) });
  } else if (result && result.error) {
    chrome.action.setBadgeBackgroundColor({ color: '#cf1322' });
    chrome.action.setBadgeText({ text: '!' });
  }
  if (tabId) closeIfOurs(tabId);
}

// Tabs this extension opened itself for a timed sync, closed once synced. Kept
// in session storage: an MV3 worker sleeps after ~30s and forgets variables.
async function closeIfOurs(tabId) {
  const { opened = [] } = await chrome.storage.session.get('opened');
  if (!opened.includes(tabId)) return;
  await chrome.storage.session.set({ opened: opened.filter((id) => id !== tabId) });
  chrome.tabs.remove(tabId).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'preply-sync') post(msg.text, msg.url, sender.tab && sender.tab.id);
  if (msg.type === 'sync-now') syncNow(true);
});

// Every few hours, if nothing has synced meanwhile, open the conversation in a
// background tab for a minute so lessons are caught even when the chat was
// never opened after the lesson.
async function syncNow(force) {
  const { chatUrl, lastSync } = await chrome.storage.local.get(['chatUrl', 'lastSync']);
  if (!chatUrl) return;
  if (!force && lastSync && Date.now() - lastSync.at < EVERY_HOURS * 3600e3) return;
  const tab = await chrome.tabs.create({ url: chatUrl, active: false });
  const { opened = [] } = await chrome.storage.session.get('opened');
  await chrome.storage.session.set({ opened: [...opened, tab.id] });
  // Closed anyway after two minutes if the page never synced.
  chrome.alarms.create('close-' + tab.id, { delayInMinutes: 2 });
}

chrome.runtime.onInstalled.addListener(() => chrome.alarms.create('sync', { periodInMinutes: 60 }));
chrome.runtime.onStartup.addListener(() => chrome.alarms.create('sync', { periodInMinutes: 60 }));
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'sync') syncNow(false);
  if (a.name.startsWith('close-')) closeIfOurs(Number(a.name.slice(6)));
});
