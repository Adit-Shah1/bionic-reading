// ── Bionic Reading engine ────────────────────────────────────────────────────
// Rewrites text nodes into <brx-w data-t="original"><b>stem</b><t>tail</t></brx-w>.
// The original string rides along in data-t so reverting is one pass with no side table.

// Never touch text under these: it is code, UI chrome, or something the user is editing.
const SKIP_SEL =
  'script,style,noscript,code,pre,kbd,samp,var,textarea,input,select,option,' +
  'svg,math,canvas,iframe,brx-w,[contenteditable]:not([contenteditable="false"])';

const HAS_LETTER = /\p{L}/u;
const SPLIT_WORD = /^(\P{L}*)(\p{L}+)([\s\S]*)$/u;
// Not words — bolding "ht" of "https" is pure noise.
const URLISH = /:\/\/|^www\.|^\S+@\S+\.\S/;

/** How many leading letters to bold. Pure — the tests hang off this. */
function fixation(len, strength) {
  if (len <= 1) return 1;
  return Math.min(len, Math.max(1, Math.round(len * strength)));
}

/** Text -> DocumentFragment of alternating <b>/<t>, preserving whitespace exactly. */
function bionicFragment(text, strength) {
  const frag = document.createDocumentFragment();
  for (const tok of text.split(/(\s+)/)) {
    if (!tok) continue;
    const m = HAS_LETTER.test(tok) && !URLISH.test(tok) && tok.match(SPLIT_WORD);
    if (!m) {
      frag.append(tok); // whitespace, numbers, punctuation, emoji, URLs, emails
      continue;
    }
    const [, lead, word, rest] = m;
    const n = fixation(word.length, strength);
    if (lead) frag.append(lead);
    const b = document.createElement('b');
    b.textContent = word.slice(0, n);
    frag.append(b);
    const tailText = word.slice(n) + rest;
    if (tailText) {
      const t = document.createElement('t');
      t.textContent = tailText;
      frag.append(t);
    }
  }
  return frag;
}

function wrap(node, strength) {
  const el = document.createElement('brx-w');
  el.dataset.t = node.nodeValue;
  el.append(bionicFragment(node.nodeValue, strength));
  node.replaceWith(el);
}

function acceptText(node) {
  if (!node.nodeValue || !node.nodeValue.trim()) return false;
  const p = node.parentElement;
  if (!p) return false;
  if (p.closest(SKIP_SEL)) return false;
  // Belt and braces on the one that actually loses user data: a nested
  // contenteditable="false" inside an editable region still reads as editable here.
  if (p.isContentEditable) return false;
  return true;
}

function collect(root, out) {
  if (root.nodeType === Node.TEXT_NODE) {
    if (acceptText(root)) out.push(root);
    return out;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return out;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (acceptText(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  for (let n; (n = walker.nextNode()); ) out.push(n);
  return out;
}

function revertAll(root = document.body) {
  for (const el of root.querySelectorAll('brx-w')) el.replaceWith(new Text(el.dataset.t));
  root.normalize(); // merge the split text nodes back so the DOM is identical, not just equivalent
}

// ── Live page controller ─────────────────────────────────────────────────────

const Engine = {
  on: false,
  settings: { ...DEFAULTS },
  queue: [],
  pending: new Set(),
  mo: null,
  timer: 0,

  start(settings) {
    this.settings = settings;
    this.applyStyle();
    if (this.on) return;
    this.on = true;
    this.mo ||= new MutationObserver((recs) => this.onMutate(recs));
    this.queue = collect(document.body, []);
    this.pump();
  },

  stop() {
    this.on = false;
    this.mo?.disconnect();
    this.queue.length = 0;
    this.pending.clear();
    clearTimeout(this.timer);
    revertAll();
    this.clearStyle();
  },

  // Re-render with new settings: cheapest correct thing is revert + reapply.
  restyle(settings) {
    if (!this.on) {
      this.settings = settings;
      return;
    }
    const changedText = settings.strength !== this.settings.strength;
    this.settings = settings;
    this.applyStyle();
    if (!changedText) return; // weight/dim/spacing are pure CSS, no DOM work needed
    this.mo?.disconnect();
    revertAll();
    this.queue = collect(document.body, []);
    this.pump();
  },

  pump() {
    this.mo.disconnect(); // our own writes must not feed back in as mutations
    const t0 = performance.now();
    while (this.queue.length && performance.now() - t0 < 8) {
      const n = this.queue.pop();
      if (n.isConnected && acceptText(n)) wrap(n, this.settings.strength);
    }
    this.observe();
    if (this.queue.length) requestIdle(() => this.on && this.pump());
  },

  observe() {
    this.mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  },

  onMutate(recs) {
    for (const r of recs) {
      if (r.type === 'characterData') {
        if (r.target.parentElement && !r.target.parentElement.closest('brx-w')) {
          this.pending.add(r.target);
        }
      } else {
        for (const n of r.addedNodes) if (!(n.parentElement?.closest('brx-w'))) this.pending.add(n);
      }
    }
    if (!this.pending.size) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 150);
  },

  flush() {
    if (!this.on) return;
    for (const root of this.pending) if (root.isConnected) collect(root, this.queue);
    this.pending.clear();
    if (this.queue.length) this.pump();
  },

  applyStyle() {
    const s = this.settings;
    const r = document.documentElement;
    r.style.setProperty('--brx-fw', s.weight);
    r.style.setProperty('--brx-dim', s.dim);
    // ponytail: typography overrides use `*` + !important because nothing weaker beats
    // arbitrary site CSS. Both default to 0 (off) so most pages never see this rule.
    if (s.lineHeight || s.letterSpacing) {
      r.style.setProperty('--brx-lh', s.lineHeight || 'normal');
      r.style.setProperty('--brx-ls', s.letterSpacing ? `${s.letterSpacing}em` : 'normal');
      r.dataset.brxTypo = '';
    } else {
      delete r.dataset.brxTypo;
    }
  },

  clearStyle() {
    const r = document.documentElement;
    for (const p of ['--brx-fw', '--brx-dim', '--brx-lh', '--brx-ls']) r.style.removeProperty(p);
    delete r.dataset.brxTypo;
  },
};

const requestIdle = globalThis.requestIdleCallback || ((fn) => setTimeout(fn, 16));

// ── Wiring ───────────────────────────────────────────────────────────────────
// Skipped on extension pages and in test.html, which load this file purely to reuse
// bionicFragment() — so the popup preview is rendered by the real engine, not a copy.

if (globalThis.chrome?.runtime?.id && location.protocol !== 'chrome-extension:') {
  const host = hostKey(location.href);

  const setBadge = () => chrome.runtime.sendMessage({ type: 'badge', on: Engine.on }).catch(() => {});

  const toggle = async (on) => {
    const settings = await loadSettings();
    if (on) Engine.start(settings);
    else Engine.stop();
    setBadge();
    return Engine.on;
  };

  chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
    if (msg.type === 'state') {
      respond({ on: Engine.on, host });
      return false;
    }
    if (msg.type === 'toggle') {
      toggle(msg.on ?? !Engine.on).then((on) => respond({ on, host }));
      return true; // async respond
    }
    return false;
  });

  // Options page edits land here in every open tab, so changes are live everywhere.
  chrome.storage.onChanged.addListener(async (changes) => {
    const settings = await loadSettings();
    if (changes.sites || changes.mode) {
      const want = autoOn(settings, host);
      if (want !== Engine.on) {
        want ? Engine.start(settings) : Engine.stop();
        setBadge();
        return;
      }
    }
    Engine.restyle(settings);
  });

  loadSettings().then((settings) => {
    if (autoOn(settings, host)) {
      Engine.start(settings);
      setBadge();
    }
  });
}
