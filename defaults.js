// Shared by content script, popup, and options page. Loaded as a plain script in all three.
const DEFAULTS = {
  strength: 0.4,       // fraction of each word to bold, 0.1 - 0.9
  weight: 700,         // font-weight of the bold stem
  dim: 1,              // opacity of the non-bold tail, 0.3 - 1
  lineHeight: 0,       // 0 = leave the site's own line-height alone
  letterSpacing: 0,    // em, 0 = leave alone
  mode: 'remember',    // 'remember' | 'always' | 'manual'
  sites: {},           // { 'example.com': true (always on) | false (never on) }
};

// Site key: hostname without www. Subdomains are distinct on purpose — you may want
// it on news.ycombinator.com but not on mail.google.com.
function hostKey(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return ''; // chrome://, about:blank, file:// with no host
  }
}

async function loadSettings() {
  return { ...DEFAULTS, ...(await chrome.storage.sync.get(null)) };
}

// Should the content script switch itself on for this host, unprompted?
function autoOn(settings, host) {
  const pinned = settings.sites[host];
  if (pinned !== undefined) return pinned;
  return settings.mode === 'always';
}
