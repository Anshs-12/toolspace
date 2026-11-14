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
the browser tab and is not uploaded. The site sends cookieless usage counts to
[Umami Cloud](https://umami.is), and, only if a visitor accepts the cookie
banner, uses Google Analytics 4. Both are described below and on the About page.

## Analytics

Two services, side by side. Umami runs for every visitor and sets no cookies;
Google Analytics runs only for visitors who accept the cookie banner. Both
count page views and tool runs with only the tool's ID, never tool input.

### Umami

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
that destination (plus Google Analytics', below) for requests and loads scripts only from this site. The
CSP limits where data can go; the allowlist above is what limits what is sent.

**Tests.** `e2e/umami.spec.ts` serves the production build as
`https://toolspace.tech` inside the test browser and answers the collection
endpoint with a mock, so tracking really runs without reaching Umami. It
types canary inputs, runs tools, opens a share link and navigates, then checks
the decoded payloads and headers contain no input, query or fragment.

#### Updating the pinned tracker

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
`npx playwright test e2e/umami.spec.ts`.

### Google Analytics

Google Analytics 4 (measurement ID `G-F1P7CTRGH3`), opt-in only.

- **Consent** (`src/lib/consent.ts`, banner in `src/components/ConsentBanner.tsx`).
  Nothing from Google loads until the visitor clicks Accept: no gtag.js, no
  requests, no consent pings. Consent mode starts with `analytics_storage`
  (and the ad signals) denied and grants only analytics storage on Accept.
  The choice is kept in `localStorage` and can be changed from "Cookie
  settings" in the footer or on the About page. Rejecting after accepting sets
  `ga-disable-G-F1P7CTRGH3`, updates consent to denied and deletes every
  cookie starting with `_ga`.
- **Guards.** Only on `toolspace.tech` (never localhost), and never with Do Not
  Track on, even after Accept.
- **What GA is given** (`src/lib/consent.ts`, set with gtag's documented
  `set`/`config` before gtag.js loads). `page_location` is origin + pathname
  plus only the standard `utm_*` campaign tags (never the `#` fragment, where
  share links keep their input); `page_title` the static title from the build;
  `page_referrer` another site's origin only. Before gtag.js loads, every
  other query parameter is removed from the address bar (the site uses none),
  because GA's site-search event reads the real address bar. Page views are
  sent by hand (`send_page_view: false`), once per page load. GA's own
  events (session start, first visit, `user_engagement`, `scroll`, form and
  outbound-click events) run unchanged; nothing rewrites them.
- **`tool_run`** carries only `{ tool: "<page slug>" }`. `useToolRun`
  (`src/lib/analytics.ts`) sends it when a tool shows a new successful result
  after the visitor interacted with it, once it has stayed unchanged for 2
  seconds. Errors, empty input, restored input and unchanged results don't
  count.
- **Places input could reach GA's automatic events, and what stops it:**
  - the ignore-rule `<form>` in the diff checker has an explicit `action` (the
    page path); its default is the page URL, which after sharing holds both
    texts in the `#`, and GA's `form_start` reports it as `form_destination`.
  - links in the Markdown preview come from the visitor's text: their clicks
    don't propagate past the preview, so GA's outbound-click and
    file-download tracking never sees their URLs or text. The links still
    open.
  Any new `<form>`, or any place that renders links from user input, needs
  the same treatment; `e2e/google-analytics.spec.ts` covers the current ones.
- **Consent switch** (`src/lib/gaGuard.ts`). While analytics isn't active (no
  choice, rejected, revoked, Do Not Track), any request to a Google analytics
  or ads host is dropped. It's needed because gtag.js still sends hits it
  queued before a revoke. It never reads or changes a request while analytics
  is active. It wraps `fetch`, `sendBeacon` and `XMLHttpRequest`; gtag.js's
  `<img>` pixel and iframe transports are blocked by the CSP (no outside
  images or frames).
- **CSP** (`src/csp.ts`): scripts from `www.googletagmanager.com`, requests to
  `www.google-analytics.com`. These were the only Google hosts gtag.js used in
  testing; no wildcards.
- **Tests.** `e2e/google-analytics.spec.ts` serves the build as
  `https://toolspace.tech`, loads the real gtag.js and mocks every Google
  collection endpoint. It covers no choice, Reject, Accept, revoke, Do Not
  Track, the events GA still sends, and leaks: canary input, share links, a
  canary query, the ignore-rule form, Markdown links, navigation and an
  outside referrer.

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

