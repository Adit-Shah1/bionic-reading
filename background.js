// Two jobs only: relay the keyboard shortcut, and paint the badge.
// Content scripts can't reach chrome.action, hence the badge relay.

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== 'toggle') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) chrome.tabs.sendMessage(tab.id, { type: 'toggle' }).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type !== 'badge' || !sender.tab) return;
  const tabId = sender.tab.id;
  chrome.action.setBadgeText({ tabId, text: msg.on ? 'ON' : '' });
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#1f3d99' });
});
