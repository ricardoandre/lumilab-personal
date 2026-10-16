chrome.action.setBadgeText({ text: '' });
chrome.storage.local.get(['lastSync', 'chatUrl']).then(({ lastSync, chatUrl }) => {
  const el = document.getElementById('status');
  if (!chatUrl) document.getElementById('now').disabled = true;
  if (!lastSync) return;
  const when = new Date(lastSync.at).toLocaleString();
  const r = lastSync.result || {};
  if (r.error) { el.className = 'bad'; el.textContent = `Last try ${when} failed: ${r.error}`; return; }
  el.textContent = `Last synced ${when}: ${r.lessons} lesson(s) seen, ${r.newWords} new word(s).`;
});
document.getElementById('now').onclick = () => {
  chrome.runtime.sendMessage({ type: 'sync-now' });
  document.getElementById('status').textContent = 'Syncing… (opens the chat in a background tab for a moment)';
};
