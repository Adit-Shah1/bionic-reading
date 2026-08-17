# Bionic Reading

A Chrome extension that bolds the leading letters of every word on any website, so your eyes
fixate on the stem and your brain fills in the rest. Many neurodivergent readers find it makes
long text markedly less tiring to get through.

It looks like this:

> **Atte**ntion **neurod**ivergent **comm**unity — **th**is **bi**onic **rea**ding **me**thod
> **i**s **abso**lutely **mi**nd **blo**wing. **Yo**ur **ey**es **sc**an **t**he **fi**rst
> **bo**ld **let**ters **a**nd **yo**ur **br**ain **ce**nter **autom**atically **comp**letes
> **t**he **wo**rds. **I**t **le**ts **y**ou **re**ad **tw**ice **a**s **fa**st, **i**s **le**ss
> **overw**helming **a**nd **he**lps **y**ou **t**o **st**ay **foc**used.

No build step, no dependencies, no accounts, no network access. About 1,100 lines of plain
JavaScript in a 330 KB folder.

---

## Install

Not on the Web Store — load it from source, which takes about twenty seconds.

1. Open `chrome://extensions` (Arc: `arc://extensions`, Edge: `edge://extensions`)
2. Turn on **Developer mode**, top right
3. Click **Load unpacked** and select this folder
4. Pin the icon to your toolbar so the toggle is one click away

To update later, pull the latest files and hit **Reload** on the extension card.

## Use

| | |
|---|---|
| Toolbar icon | Opens the popup: on/off switch, strength slider, and "always on for this site" |
| <kbd>Alt</kbd>+<kbd>B</kbd> | Toggles the current page without opening anything |
| **ON** badge | Shows on the icon whenever the current tab is bionic |
| All settings | Link at the bottom of the popup, or right-click the icon → Options |

**It starts off everywhere.** Turn it on where you want it, tick *always on for this site*, and it
applies itself on every future visit to that domain. If you'd rather have it everywhere by
default, switch *When to turn on* in the options.

## Settings

| Setting | Default | What it does |
|---|---|---|
| Bold strength | 40% | How much of each word gets bolded. Lower is subtler; higher is heavier. |
| Bold weight | 700 | Drop to 500–600 on sites with thin fonts where 700 looks like a smudge. |
| Dim the rest | 100% | Fades the non-bold tail to sharpen contrast. 100% means no fading. |
| Line spacing | off | Overrides the site's line height. Off by default — it reflows layouts. |
| Letter spacing | off | Same caveat. Both are here because they help some dyslexic readers a lot. |
| When to turn on | remember | `remember` (only sites you enabled) · `always` (everywhere but your blocklist) · `manual` (never automatic) |
| Sites | empty | Two lists: always on, never on. Paste a URL or type a bare hostname. |
| Backup | — | Copy your settings as JSON, paste them back on another machine. |

Changes apply live to every open tab — no reload.

Strength is worth playing with. The same sentence at 20%, 40%, and 60%:

> **Y**our **e**yes **s**can **t**he **f**irst **b**old **l**etters.
>
> **Yo**ur **ey**es **sc**an **t**he **fi**rst **bo**ld **let**ters.
>
> **Yo**ur **ey**es **sc**an **th**e **fir**st **bo**ld **lett**ers.

## Privacy

The extension makes no network requests of any kind. There is no analytics, no telemetry, no
remote config, and no server. Your settings live in `chrome.storage.sync`, which means Chrome
syncs them across your own signed-in browsers and nowhere else.

It requests `<all_urls>` because "works on any website" is the entire feature — it needs
permission to read and restyle text wherever you switch it on. It does not request `tabs`,
`scripting`, `history`, `cookies`, or host access to any external domain.

## How it works

Each qualifying text node is swapped for a wrapper element:

```html
<brx-w data-t="Attention"><b>Atte</b><t>ntion</t></brx-w>
```

A few decisions worth knowing if you're editing this:

- **`brx-w` and `t` are deliberately unknown elements.** They're inline by default, carry no
  user-agent styles, and site CSS written for `span` or `b` mostly won't match them.
- **The original string rides along in `data-t`.** Reverting is one pass with no side table:
  `el.replaceWith(new Text(el.dataset.t))`, then `normalize()` to merge the text nodes back. The
  DOM ends up byte-for-byte what it was, not merely equivalent — there's a test that asserts it.
- **The tail is its own element** because a child can't be more opaque than its parent, so the
  dimming has to live on the part being faded, not the wrapper.
- **Nothing under `script`, `style`, `pre`, `code`, `kbd`, `samp`, `var`, `svg`, `math`, form
  fields, or anything `contenteditable` is ever touched.** The editable check is the one that
  matters: rewriting a text node under a live editor corrupts what you're typing and can get
  saved back to a server. It's checked twice, by selector and by `isContentEditable`.
- **A debounced `MutationObserver` catches content that loads later** — infinite scroll, SPA
  route changes, lazy comments. It disconnects around our own writes so they can't feed back in.
- **Work is chunked into 8 ms slices** across idle callbacks, so a long article can't block a
  frame. In practice 10,000 words wrap in ~17 ms, so the chunking is insurance rather than a
  bottleneck.

### Files

| File | Lines | |
|---|---|---|
| `content.js` | 240 | The engine — walk, bold, revert, observe. The only interesting file. |
| `content.css` | 25 | Bold weight and tail dimming, driven by CSS custom properties. |
| `defaults.js` | 31 | Settings shape and host-matching, shared by every context. |
| `popup.html/.js` | 122 | Toggle, strength, per-site pin. |
| `options.html/.js` | 263 | Every knob, both site lists, backup/restore. |
| `ui.css` | 129 | Shared design tokens for popup and options. Light and dark. |
| `background.js` | 15 | Service worker: keyboard shortcut relay and toolbar badge. |
| `test.html/.js` | 147 | 42 assertions. |
| `demo.html` | 75 | Manual test page. |

The popup and options pages load `content.js` too, so their live previews are rendered by the
real engine rather than a copy of it that could drift.

## Development

There's nothing to install and nothing to build. Edit a file, hit **Reload** on the extension
card, reload the page.

**Tests** — open `test.html` in a browser. Green means pass; the summary line at the top gives
the count. It covers fixation boundaries, the tokenizer (whitespace, numbers, punctuation, emoji,
accents, URLs, emails), the skip list, the apply/revert round trip, throughput on a 10,000-word
document, and the site-matching logic. No framework, no runner, no dependencies.

Because `content.js` guards its extension wiring behind a protocol check, `test.html` and
`demo.html` can load the same file straight from disk and call into it directly.

**Demo** — open `demo.html` for a page with apply/revert buttons, a strength slider, and a button
that appends a paragraph so you can watch the observer pick it up.

## Known limits

- **Shadow DOM isn't traversed.** Text inside web components stays plain. Fix by recursing into
  `el.shadowRoot` in the walker.
- **Fixation is Latin-tuned.** A character-count split does nothing useful for CJK or Arabic.
- **PDFs are out of reach.** Chrome's PDF viewer is a plugin, not a DOM.
- **Virtual-DOM churn.** Replacing a text node can orphan a React or Vue reference to it. In
  practice the parent re-renders and the observer re-applies; toggling off always restores the
  page exactly.
- **Minor CSS shifts.** Sites using `::first-letter` or `p > span` selectors can render slightly
  differently while it's on, since the text node is no longer a direct child.

## Credits

The bionic reading concept was popularised by [Bionic Reading](https://bionic-reading.com/).
This is an independent implementation and isn't affiliated with them.

## License

MIT.
