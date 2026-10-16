// Runs on every preply.com page. On a conversation it sends the page's text to
// the extension's background worker whenever the text changes, so words the
// tutor writes during a lesson reach Lumilab without anyone doing anything.
// The server works out which lines are words; this file only reads the page.
(() => {
  let last = '';
  let timer = null;

  function send() {
    if (!/\/messages/.test(location.pathname)) return;
    const text = document.body.innerText;
    if (!text || text === last) return;
    // Only bother when there is something that looks like a tutor's word:
    // a line of Chinese characters.
    if (!/\p{Script=Han}/u.test(text)) return;
    last = text;
    chrome.runtime.sendMessage({ type: 'preply-sync', text, url: location.href });
  }

  const schedule = () => { clearTimeout(timer); timer = setTimeout(send, 4000); };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
  schedule();
})();
