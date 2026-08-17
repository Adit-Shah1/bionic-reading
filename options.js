const $ = (id) => document.getElementById(id);
const SAMPLE =
  'Attention neurodivergent community — this bionic reading method is absolutely mind blowing. ' +
  'Your eyes scan the first bold letters and your brain center automatically completes the words.';

// slider id -> [storage value from slider value, label text]
const SLIDERS = {
  strength: [(v) => v / 100, (s) => `${Math.round(s * 100)}%`],
  weight: [(v) => +v, (s) => String(s)],
  dim: [(v) => v / 100, (s) => `${Math.round(s * 100)}%`],
  lineHeight: [(v) => v / 10, (s) => (s ? `${s.toFixed(1)}` : 'off')],
  letterSpacing: [(v) => v / 100, (s) => (s ? `${s.toFixed(2)}em` : 'off')],
};
const TO_SLIDER = {
  strength: (s) => s * 100,
  weight: (s) => s,
  dim: (s) => s * 100,
  lineHeight: (s) => s * 10,
  letterSpacing: (s) => s * 100,
};

let settings;

function render() {
  for (const [id, [, label]] of Object.entries(SLIDERS)) {
    $(id).value = TO_SLIDER[id](settings[id]);
    $(`${id}Val`).textContent = label(settings[id]);
  }
  $('mode').value = settings.mode;

  const sample = $('sample');
  sample.replaceChildren(bionicFragment(SAMPLE, settings.strength));
  sample.style.setProperty('--s-fw', settings.weight);
  sample.style.setProperty('--s-dim', settings.dim);
  sample.style.lineHeight = settings.lineHeight || '';
  sample.style.letterSpacing = settings.letterSpacing ? `${settings.letterSpacing}em` : '';

  renderList('allow', true);
  renderList('block', false);
  $('json').value = JSON.stringify(settings, null, 2);
}

function renderList(id, want) {
  const hosts = Object.keys(settings.sites).filter((h) => settings.sites[h] === want).sort();
  const ul = $(id);
  ul.replaceChildren();
  if (!hosts.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Nothing here yet.';
    ul.append(li);
    return;
  }
  for (const h of hosts) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = h;
    const del = document.createElement('button');
    del.textContent = '×';
    del.title = `Remove ${h}`;
    del.addEventListener('click', () => {
      const sites = { ...settings.sites };
      delete sites[h];
      save({ sites });
    });
    li.append(name, del);
    ul.append(li);
  }
}

async function save(patch) {
  settings = { ...settings, ...patch };
  render();
  await chrome.storage.sync.set(patch);
}

function status(msg) {
  $('status').textContent = msg;
  setTimeout(() => ($('status').textContent = ''), 2000);
}

for (const [id, [toValue]] of Object.entries(SLIDERS)) {
  $(id).addEventListener('input', (e) => save({ [id]: toValue(e.target.value) }));
}

$('mode').addEventListener('change', (e) => save({ mode: e.target.value }));

for (const btn of document.querySelectorAll('[data-add]')) {
  btn.addEventListener('click', () => {
    const want = btn.dataset.add === 'true';
    const input = $(want ? 'addAllow' : 'addBlock');
    // Accept a pasted URL as readily as a bare hostname.
    const host = hostKey(input.value.trim()) || hostKey(`https://${input.value.trim()}`);
    if (!host) return status('Not a valid site.');
    input.value = '';
    save({ sites: { ...settings.sites, [host]: want } });
  });
}

$('export').addEventListener('click', async () => {
  $('json').value = JSON.stringify(settings, null, 2);
  $('json').select();
  await navigator.clipboard.writeText($('json').value).catch(() => {});
  status('Copied.');
});

$('import').addEventListener('click', async () => {
  let parsed;
  try {
    parsed = JSON.parse($('json').value);
  } catch {
    return status("That isn't valid JSON.");
  }
  // Only accept keys we know, with the types we expect — this box takes pasted text.
  const clean = {};
  for (const [k, v] of Object.entries(DEFAULTS)) {
    if (parsed[k] !== undefined && typeof parsed[k] === typeof v) clean[k] = parsed[k];
  }
  await chrome.storage.sync.clear();
  await chrome.storage.sync.set(clean);
  settings = { ...DEFAULTS, ...clean };
  render();
  status('Loaded.');
});

$('reset').addEventListener('click', async () => {
  await chrome.storage.sync.clear();
  settings = { ...DEFAULTS };
  render();
  status('Reset.');
});

loadSettings().then((s) => {
  settings = s;
  render();
});
