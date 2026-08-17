const $ = (id) => document.getElementById(id);
const SAMPLE = 'Your eyes scan the first bold letters and your brain completes the words.';

let settings, tab, host;

function renderSample() {
  $('sample').replaceChildren(bionicFragment(SAMPLE, settings.strength));
  $('sample').style.setProperty('--s-fw', settings.weight);
  $('sample').style.setProperty('--s-dim', settings.dim);
  $('strengthVal').textContent = `${Math.round(settings.strength * 100)}%`;
  $('strength').value = Math.round(settings.strength * 100);
}

function disable(reason) {
  for (const el of document.querySelectorAll('input')) el.disabled = true;
  $('sample').textContent = reason;
}

(async () => {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  host = hostKey(tab?.url || '');
  settings = await loadSettings();

  $('host').textContent = host || 'this site';
  $('pin').checked = settings.sites[host] === true;
  renderSample();

  // No content script on chrome://, the Web Store, or PDFs — say so instead of failing silently.
  const state = await chrome.tabs.sendMessage(tab.id, { type: 'state' }).catch(() => null);
  if (!state) {
    disable("Chrome doesn't allow extensions to run on this page.");
    return;
  }
  $('power').checked = state.on;

  $('power').addEventListener('change', async (e) => {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'toggle', on: e.target.checked });
    $('power').checked = res.on;
  });
})();

$('strength').addEventListener('input', (e) => {
  settings.strength = e.target.value / 100;
  renderSample();
  chrome.storage.sync.set({ strength: settings.strength });
});

$('pin').addEventListener('change', (e) => {
  const sites = { ...settings.sites };
  // Unchecking means "stop forcing it here". Under mode:'always' that has to be an
  // explicit false, otherwise the site just falls back to being on again.
  if (e.target.checked) sites[host] = true;
  else if (settings.mode === 'always') sites[host] = false;
  else delete sites[host];
  settings.sites = sites;
  chrome.storage.sync.set({ sites });
});

$('opts').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
