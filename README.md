# toolspace

Free developer tools that run in your browser.

**[toolspace.tech](https://toolspace.tech)** · [MIT license](LICENSE)

toolspace is a collection of developer tools: diff checking, JSON and data
conversion, formatters, encoders, generators and more. The tools run in the
browser tab and need no account. Every tool gets its own page, built to real
HTML at deploy time so the heading, how-to and FAQ are there before any
JavaScript runs.

## Highlights

- **Runs in the browser.** Tool input (text, files, tokens, images) is
  processed by code running in the page. See [Privacy](#privacy) for exactly
  what the site does send.
- **One page per tool.** Each tool is a real route with its own title,
  description, canonical URL, how-to and FAQ, prerendered to static HTML.
- **Diff engine for large input.** Myers O(ND) line diff (the algorithm
  behind `git diff`), linear-space, run in a Web Worker. The editors and diff
  view only render what is on screen. Time budgets are enforced by the tests
  (see [Testing](#testing)).
- **Merge, patch, share.** Line-by-line merge with undo, `.patch` export
  (the tests apply generated patches with the real `git apply`), and share
  links that keep both texts after the `#`, which browsers do not send to
  servers.
- **Readable by agents.** Every page is also served as Markdown
  (`/json-formatter.md`, or `Accept: text/markdown` on the page URL), plus
  `llms.txt`, `llms-full.txt` and `ai.txt` at the root.
- **Per-page sitemap dates.** `sitemap.xml` carries a `<lastmod>` per page, recorded
  from when that page's own content last changed, not the build date.

## Privacy

What stays in the browser: tool input (text, files, tokens, images) is
processed by code in the page. The tool code makes no network requests with
it, and the Content Security Policy (`src/csp.ts`) only allows connections
to Umami and Clarity, described below.

What the server side is: static files served from Cloudflare behind a small
Worker (`src/worker.ts`) that redirects http and the old address, and serves
the Markdown versions of pages. It handles page requests only; no tool
receives input from it.

What is sent: cookieless usage counts to [Umami Cloud](https://umami.is)
(page paths and a `tool-run` event with the tool's ID), and Microsoft
Clarity heatmaps and session recordings with tool areas masked. Like any
website, the host and these services see request metadata such as IP
address. Details are below and on the About page.

## Analytics

Two services, both for every visitor on `toolspace.tech` with no banner, and
neither with Do Not Track on. Umami sets no cookies. Page views and tool runs
are counted with only the tool's ID, never tool input.

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
that destination (plus Clarity's, below) for requests and loads scripts only
from this site. The CSP limits where data can go; the allowlist above is what
limits what is sent.

**Tests.** `e2e/umami.spec.ts` serves the production build as
`https://toolspace.tech` inside the test browser and answers the collection
endpoint with a mock, so tracking really runs without reaching Umami. It types
canary inputs, runs tools, opens a share link and navigates, then checks the
decoded payloads and headers contain no input, query or fragment.

#### Updating the pinned tracker

`public/umami.js` is a copy of `https://cloud.umami.is/script.js`, served from
this site (a method
[Umami documents](https://umami.is/docs/bypass-ad-blockers)) so no third-party
script runs on the page. It doesn't update itself. To update:

```sh
curl -sS https://cloud.umami.is/script.js -o /tmp/umami.js
tail -n +6 public/umami.js | shasum -a 256   # the pinned copy (hash is in its header)
shasum -a 256 /tmp/umami.js                   # the live one
diff <(npx prettier --parser babel /tmp/umami.js) <(tail -n +6 public/umami.js | npx prettier --parser babel)
```

If they differ, read the diff (new payload fields, headers or endpoints), copy
the new file under the header, update the date and hash in it, and run
`npx playwright test e2e/umami.spec.ts`.

### Microsoft Clarity

Heatmaps and session recordings (`src/lib/clarity.ts`, project ID in
`CLARITY_ID`), started from the footer, which every page has.

- **Loading.** For every visitor once the browser is idle (at most 2.5 s),
  from Microsoft's tag (`www.clarity.ms/tag/<id>`). No consent banner and no
  consent calls, the same as other small tool sites. The Bing pixel in
  Microsoft's tag is blocked by the CSP (no outside images), so no Bing
  cookies. Never with Do Not Track, never off `toolspace.tech`.
- **Masking.** `<body>` gets `data-clarity-mask`, so everything is masked by
  default, including popovers and toasts. Static parts are unmasked with
  `data-clarity-unmask`: header, sidebar, page heading, the guide and FAQ
  under a tool, guides, the home page, footer. The tool area (`#tool`) stays
  masked. Any new static area that should show in recordings needs the
  attribute; anything that shows input must not have it.
- **The `#`.** Clarity records the full address and can't drop the fragment,
  where share links keep input. It never starts on a page opened with a `#`,
  and stops for good when the page puts one in the address (the diff
  checker's Share): a `history` wrapper sets the flag before the address
  changes, `consent(false)` ends the session, `_clck`/`_clsk` are deleted,
  and the request gate (`src/lib/requestGate.ts`) drops every Clarity request
  after that.
- **Events.** A tool run sets the `tool` tag and records a `tool_run` event.
- **CSP.** Scripts from `www.clarity.ms` and `scripts.clarity.ms`; requests
  to `https://*.clarity.ms` (the upload host differs per project).
- **Tests.** `e2e/clarity.spec.ts` serves Microsoft's loader with the real
  clarity.js and a mock upload, gunzips every upload and checks: no banner,
  masked tool input (with the unmasked heading as a control), no start on a
  `#` page, a full stop after the diff checker's Share, Do Not Track, and
  nothing off the live site.

## Tech stack

React 19, TypeScript, Vite, Tailwind CSS 4, CodeMirror 6, Prettier and
WebAssembly formatters in the page. Tested with Vitest (unit and property
tests) and Playwright (browser, privacy and performance tests). Deployed on
Cloudflare: a static site behind a small Worker (`src/worker.ts`,
`wrangler.jsonc`) that redirects the old address and http, and serves the
Markdown versions.

## Development

Requires Node.js.

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

- **Engine**: Myers is checked on 20,000 random inputs (5 seeds x 4,000;
  every result must rebuild both sides and be a minimal edit script);
  generated patches are applied with the real `git apply` when git is
  installed; merges must converge.
- **Browser**: diffing, split/unified, merge and undo, ignore rules, in-editor
  highlights, `.patch` download, share links, theme, and privacy checks (the
  CSP is present, no requests are made while diffing, outgoing `fetch` is
  blocked).
- **Performance**: the unit tests require the exact edit count for 20,000,
  100,000 and 500,000 lines within budgets of 500 ms, 1.5 s and 6 s
  (`src/lib/performance.test.ts`). The browser tests (`e2e/perf.spec.ts`)
  require 5k to 500k line diffs on screen within 1.5 to 6 s, under 200 rows
  in the DOM, scrolling under 100 ms, and typing in a 100,000-line document
  under 100 ms per keystroke.

Browser tests use your installed Google Chrome. To use Playwright's bundled
Chromium instead (e.g. in CI): `npx playwright install chromium` and run with
`PW_CHANNEL=`.

## How the site is built

- `src/site.ts` is the single registry. The `PAGES` list holds every page's
  id, path, title, description, keywords and `lastmod`; titles, meta and
  social tags, the sitemap, `robots.txt`, `llms.txt`/`ai.txt` and the
  cross-links between tools are all generated from it.
- Each page is a small HTML shell (e.g. `json-formatter/index.html`) that
  mounts the app with `data-page="<id>"`. Vite builds every page as its own
  entry, injects the head tags from `PAGES`, then prerenders each route
  (`src/prerender.tsx`) so the HTML is complete without JavaScript.
- Tool logic lives in `src/lib/` as plain functions with unit tests; the UI
  wraps it in `src/tools/`. Long guides live in `guides/`.
- `src/worker.ts` sits in front of the static files on Cloudflare: it 301s
  http requests and the old `workers.dev` address to `https://toolspace.tech`
  and answers Markdown requests (`/<page>.md`, content negotiation,
  `/api/md/`). Unknown URLs get `dist/404.html` with a real 404 status
  (`wrangler.jsonc`).

## Adding a tool

1. Add the page to `PAGES` in `src/site.ts` (id, path, title, description,
   keywords; set `lastmod` when the change ships).
2. Add the HTML shell at `<path>/index.html` with `data-page="<id>"`.
3. Write the logic in `src/lib/` with tests, and the UI in `src/tools/`,
   wired into the lazy map in `src/tools/ToolApp.tsx` and the page content
   (how-to, FAQ) in `src/tools/content/`.
4. `npm run test:all`, then `npm run build` and check the built page and
   sitemap in `dist/`.

## Diff accuracy

When the two texts together are at most 10,000 lines, the diff is always the
exact shortest edit script. Larger inputs are first anchored on lines that
occur once on each side (as git's patience diff does) and a search-depth cap
bounds pathological cases, so the result stays correct (it rebuilds both
files) but may occasionally be a little longer than the theoretical minimum.

## License

[MIT](LICENSE) © 2026 anshx12
