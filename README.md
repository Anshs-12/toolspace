# toolspace

Everything they paywall. Free. Your text stays in your browser.

toolspace is a diff checker that runs entirely in your browser: unlimited use,
no account, nothing uploaded. It lives at
[toolspace.tech](https://toolspace.tech).

## Features

- Myers O(ND) line diff (the algorithm behind `git diff`), linear-space like
  git's, run in a Web Worker
- Built for large files: 500,000 lines show up in about a second; the diff view
  and the CodeMirror editors only render what is on screen
- Highlights in the editors while you type, or a separate split / unified view
- Word- or character-level changes inside modified lines
- Ignore whitespace, case, or anything matching your own regex rules
- Syntax colors, folding of unchanged lines, line wrap
- Line-by-line merge with undo
- Export a `.patch` that `git apply` accepts, or save a PDF
- Change summary, plus an on-device AI summary in browsers that have one
- Share links that keep both texts after the `#`, so no server ever sees them

## Privacy

There is no backend. Tool input (text, files, tokens, images) is processed in
the browser tab and is not uploaded. The site does send cookieless usage
analytics to [Umami Cloud](https://umami.is), described below.

## Analytics

Umami counts page views and a `tool-run` event. It sets no cookies.

**What a send contains.** `public/umami-config.js` is the tracker's
[`data-before-send`](https://umami.is/docs/tracker-configuration) handler and
rebuilds every payload from this allowlist, cancelling anything else:

| Field | Value |
| --- | --- |
| `url` | the page's canonical path from the build, e.g. `/json-formatter/` (never the address bar, so no `#` or `?`) |
| `title` | the page's static title from the build |
| `referrer` | another site's origin only, e.g. `https://news.ycombinator.com/`; empty for links within toolspace |
| `hostname`, `screen`, `language`, `website` | `toolspace.tech`, e.g. `1440x900`, e.g. `en-US`, the site ID |
| `name`, `data` | only `tool-run` with `{ "tool": "<page id>" }`, e.g. `{ "tool": "json-formatter" }` |

Request headers are the tracker's `Content-Type`, `x-umami-website-id`,
`x-umami-hostname` and `x-umami-cache` (a token Umami's server issues), plus
what the browser adds to any request: user agent, `Accept-Language`, `Origin`,
client hints. No cookies (`credentials: omit`) and no `Referer` (the pages set
`referrer` to `no-referrer`). Umami's servers also see the visitor's IP
address, as with any request; per
[Umami's docs](https://umami.is/docs/metric-definitions) it is used with the
user agent and a rotating salt to estimate unique visitors, and for approximate
location, and isn't stored in the analytics records. Visitor counts are
estimates, not exact people.

**When `tool-run` fires.** `useToolRun` (`src/lib/analytics.ts`) sends it when
a tool shows a new successful result after the visitor interacted with the
tool, once the result has stayed unchanged for 2 seconds, and only if it
differs from the last result counted. Empty input, errors, the sample shown on
load, input restored from a share link or storage, and unchanged results don't
count. Validators count only a valid verdict.

**Where it sends.** Only on `toolspace.tech` (`data-domains`), not with Do Not
Track on (`data-do-not-track`), and only to `https://gateway.umami.is/api/send`,
the endpoint the Cloud script uses by default (set explicitly with
`data-host-url`). The production Content Security Policy (`src/csp.ts`) allows
that one destination for requests and loads scripts only from this site. The
CSP limits where data can go; the allowlist above is what limits what is sent.

**Tests.** `e2e/analytics.spec.ts` serves the production build as
`https://toolspace.tech` inside the test browser and answers the collection
endpoint with a mock, so tracking really runs without reaching Umami. It
types canary inputs, runs tools, opens a share link and navigates, then checks
the decoded payloads and headers contain no input, query or fragment.

### Updating the pinned tracker

`public/umami.js` is a copy of `https://cloud.umami.is/script.js`, served from
this site (a method [Umami documents](https://umami.is/docs/bypass-ad-blockers))
so no third-party script runs on the page. It doesn't update itself. To update:

```sh
curl -sS https://cloud.umami.is/script.js -o /tmp/umami.js
tail -n +6 public/umami.js | shasum -a 256   # the pinned copy (hash is in its header)
shasum -a 256 /tmp/umami.js                   # the live one
diff <(npx prettier --parser babel /tmp/umami.js) <(tail -n +6 public/umami.js | npx prettier --parser babel)
```

If they differ, read the diff (new payload fields, headers or endpoints), copy
the new file under the header, update the date and hash in it, and run
`npx playwright test e2e/analytics.spec.ts`.

## Development

```sh
npm install
npm run dev      # dev server
npm run build    # type-check and build to dist/
npm run preview  # serve the production build
```

## Testing

```sh
npm test           # unit and randomized property tests (Vitest)
npm run test:e2e   # browser tests against the production build (Playwright)
npm run test:perf  # rendering time budgets in the browser
npm run test:all   # everything
```

- **Engine**: Myers is checked against a reference LCS on 20,000 random inputs
  (every result must rebuild both sides and be minimal); generated patches are
  applied with the real `git apply`; merges must converge.
- **Browser**: diffing, split/unified, merge and undo, ignore rules, in-editor
  highlights, `.patch` download, share links, theme, and privacy checks (the
  CSP is present, no requests are made while diffing, outgoing `fetch` is
  blocked).
- **Performance**: the engine must return the exact minimal diff for 20k, 100k
  and 500k lines within time limits; in the browser, 5k–500k line diffs must be
  on screen within limits, keep under 200 rows in the DOM, scroll in one frame,
  and typing in a 100k-line document must stay under 100 ms per keystroke.

## Performance

Measured on an M-series laptop (paste to diff on screen):

| Lines   | Diff engine | On screen |
| ------- | ----------- | --------- |
| 20,000  | ~15 ms      | ~0.3 s    |
| 100,000 | ~45 ms      | ~0.4 s    |
| 500,000 | ~300 ms     | ~1.1 s    |

Inputs up to 10,000 lines always get the exact shortest edit script. Larger
inputs are first anchored on lines that occur once on each side (as git's
patience diff does) and a search-depth cap bounds pathological cases, so the
result stays correct (it rebuilds both files) but may occasionally be a little
longer than the theoretical minimum.

Browser tests use your installed Google Chrome. To use Playwright's bundled
Chromium instead (e.g. in CI): `npx playwright install chromium` and run with
`PW_CHANNEL=`.

