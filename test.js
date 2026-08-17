// Open test.html in a browser. Green = pass. No framework on purpose.
let pass = 0,
  fail = 0;

function ok(name, cond, extra = '') {
  const div = document.createElement('div');
  div.className = cond ? 'pass' : 'fail';
  div.textContent = `${cond ? '✓' : '✗'} ${name}${cond || !extra ? '' : ` — ${extra}`}`;
  document.getElementById('out').append(div);
  cond ? pass++ : fail++;
}

function eq(name, actual, expected) {
  ok(name, actual === expected, `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

// Render a string the way the page would, as plain text markers: [bold]tail
function marked(text, strength) {
  const frag = bionicFragment(text, strength);
  let s = '';
  for (const n of frag.childNodes) {
    if (n.nodeName === 'B') s += `[${n.textContent}]`;
    else s += n.textContent;
  }
  return s;
}

// ── fixation() boundaries ────────────────────────────────────────────────────
eq('1-letter word bolds whole', fixation(1, 0.4), 1);
eq('2-letter word bolds 1', fixation(2, 0.4), 1);
eq('3-letter word at 40%', fixation(3, 0.4), 1);
eq('3-letter word at 50%', fixation(3, 0.5), 2);
eq('12-letter word at 40%', fixation(12, 0.4), 5);
eq('12-letter word at 20%', fixation(12, 0.2), 2);
eq('12-letter word at 80%', fixation(12, 0.8), 10);
ok('never bolds past the end', fixation(4, 0.9) <= 4);
ok('always bolds at least 1', fixation(9, 0.01) >= 1);

// ── tokenizer ────────────────────────────────────────────────────────────────
eq('basic split', marked('the quick brown', 0.5), '[th]e [qui]ck [bro]wn');
eq('whitespace preserved', marked('a  b\n\tc', 0.5), '[a]  [b]\n\t[c]');
eq('numbers untouched', marked('you owe 4200 now', 0.5), '[yo]u [ow]e 4200 [no]w');
eq('punctuation stays out of the stem', marked('(hello, world)', 0.5), '([hel]lo, [wor]ld)');
eq('URLs untouched', marked('see https://x.com/a', 0.4), '[s]ee https://x.com/a');
eq('www URLs untouched', marked('go www.bbc.co.uk now', 0.5), '[g]o www.bbc.co.uk [no]w');
eq('emails untouched', marked('mail me@example.com ok', 0.5), '[ma]il me@example.com [o]k');
eq('emoji untouched', marked('nice 🎉 work', 0.5), '[ni]ce 🎉 [wo]rk');
eq('accented letters count', marked('café naïve', 0.5), '[ca]fé [naï]ve');
eq('hyphenated', marked('well-known', 0.5), '[we]ll-known');

// Round-trip on the exact text: bolded output must never lose or gain a character.
for (const s of ['the quick brown fox', 'a  b\n\tc', '(hello, world) 42 🎉', 'café naïve']) {
  const frag = bionicFragment(s, 0.4);
  const d = document.createElement('div');
  d.append(frag);
  eq(`text preserved: ${JSON.stringify(s)}`, d.textContent, s);
}

// ── DOM apply / revert ───────────────────────────────────────────────────────
const fixture = document.getElementById('fixture');
const before = fixture.innerHTML;

const nodes = collect(fixture, []);
for (const n of nodes) wrap(n, 0.4);

ok('found text to bold', nodes.length > 0, `found ${nodes.length}`);
ok('bolding actually happened', fixture.querySelectorAll('brx-w b').length > 0);

// The skip list is the part that can corrupt user data, so check it explicitly.
ok('<pre> untouched', fixture.querySelector('pre').innerHTML === 'const x = 1;');
ok('<textarea> untouched', fixture.querySelector('textarea').innerHTML === 'hello there');
ok(
  '[contenteditable] untouched',
  fixture.querySelector('[contenteditable]').innerHTML === 'draft text here'
);
ok('<code> untouched', fixture.querySelector('code').innerHTML === 'inline_code');
ok('<em> content IS bolded', fixture.querySelector('em brx-w') !== null);

revertAll(fixture);
eq('revert restores DOM byte-for-byte', fixture.innerHTML, before);
eq('no brx-w left behind', fixture.querySelectorAll('brx-w').length, 0);

// Double revert must be a no-op, not a crash.
revertAll(fixture);
eq('revert is idempotent', fixture.innerHTML, before);

// ── throughput on an article-sized document ──────────────────────────────────
{
  const big = document.createElement('div');
  const words = 'attention neurodivergent community bionic reading method absolutely mind blowing'.split(' ');
  for (let i = 0; i < 400; i++) {
    const p = document.createElement('p');
    p.textContent = Array.from({ length: 25 }, (_, j) => words[(i + j) % words.length]).join(' ');
    big.append(p);
  }
  document.body.append(big);
  const t0 = performance.now();
  for (const n of collect(big, [])) wrap(n, 0.4);
  const ms = Math.round(performance.now() - t0);
  const t1 = performance.now();
  revertAll(big);
  const revertMs = Math.round(performance.now() - t1);
  ok(`10,000 words wrapped in ${ms}ms`, ms < 400, `${ms}ms is too slow`);
  ok(`…and reverted in ${revertMs}ms`, revertMs < 400, `${revertMs}ms is too slow`);
  big.remove();
}

// ── settings helpers ─────────────────────────────────────────────────────────
eq('hostKey strips www', hostKey('https://www.nytimes.com/a/b'), 'nytimes.com');
eq('hostKey keeps subdomains', hostKey('https://news.ycombinator.com'), 'news.ycombinator.com');
eq('hostKey on garbage', hostKey('about:blank'), '');
ok('autoOn: unlisted site, remember mode', autoOn({ mode: 'remember', sites: {} }, 'x.com') === false);
ok('autoOn: unlisted site, always mode', autoOn({ mode: 'always', sites: {} }, 'x.com') === true);
ok('autoOn: blocked beats always', autoOn({ mode: 'always', sites: { 'x.com': false } }, 'x.com') === false);
ok('autoOn: pinned beats manual', autoOn({ mode: 'manual', sites: { 'x.com': true } }, 'x.com') === true);

const sum = document.getElementById('summary');
sum.textContent = fail ? `${fail} FAILED, ${pass} passed` : `all ${pass} passed`;
sum.className = fail ? 'fail' : 'pass';
console.log(fail ? `FAIL ${fail}/${pass + fail}` : `PASS ${pass}/${pass}`);
