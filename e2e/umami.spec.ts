import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * Umami telemetry, end to end against the production build.
 *
 * The tracker only sends on toolspace.tech (data-domains), so these tests serve
 * the local build AS https://toolspace.tech inside the browser: every request
 * to that origin is answered from the preview server, and the collection
 * endpoint is answered by a mock that records what was sent. Nothing reaches
 * the real site or the real analytics account; any other request is aborted
 * and reported. Service workers are blocked so every request passes the routes.
 * Each test starts with Google Analytics rejected (its banner would cover the
 * page); e2e/google-analytics.spec.ts covers GA.
 */

const PROD = 'https://toolspace.tech';
const COLLECT = 'https://gateway.umami.is/api/send';
const WEBSITE_ID = 'bfdd0fe7-099d-43ab-b329-2cee9f21a87f';
const SETTLE_MS = 2000; // TOOL_RUN_SETTLE_MS in src/lib/analytics.ts

/** Distinct strings put into inputs, a query string and a referrer; none may appear in telemetry. */
const CANARY = {
  json: 'cnryJsonQ7xK2',
  invalid: 'cnryBadW4pZ9',
  original: 'cnryLeftM3vB8',
  changed: 'cnryRightT6nC1',
  query: 'cnryQueryR2dF5',
  referrer: 'cnryRefH8sL4',
};

const PAYLOAD_KEYS = ['hostname', 'language', 'referrer', 'screen', 'title', 'url', 'website'];
const HEADERS_FROM_TRACKER = ['content-type', 'x-umami-website-id', 'x-umami-hostname', 'x-umami-cache'];

type Hit = { url: string; method: string; headers: Record<string, string>; raw: string; type: string; payload: Record<string, unknown> };

test.use({ serviceWorkers: 'block' });

/** Serves the local build as https://toolspace.tech and records sends to the mocked collection endpoint. */
async function production(context: BrowserContext, baseURL: string) {
  const hits: Hit[] = [];
  const unexpected: string[] = [];
  await context.addInitScript(() => localStorage.setItem('toolspace-analytics-consent', 'denied'));
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin === PROD) {
      const response = await route.fetch({ url: `${baseURL}${url.pathname}${url.search}` });
      return route.fulfill({ response });
    }
    if (`${url.origin}${url.pathname}` === COLLECT) {
      if (req.method() === 'POST') {
        const raw = req.postData() ?? '';
        const body = JSON.parse(raw) as { type: string; payload: Record<string, unknown> };
        hits.push({ url: req.url(), method: req.method(), headers: await req.allHeaders(), raw, type: body.type, payload: body.payload });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': 'content-type, x-umami-website-id, x-umami-hostname, x-umami-cache',
        },
        body: JSON.stringify({ cache: 'mock-cache-token' }),
      });
    }
    if (url.origin === baseURL) return route.continue();
    unexpected.push(`${req.method()} ${req.url()}`);
    return route.abort();
  });
  const runs = () => hits.filter((h) => h.payload.name === 'tool-run');
  const views = () => hits.filter((h) => h.payload.name === undefined);
  return { hits, unexpected, runs, views };
}

/** Everything a send carried, decoded every way it could hide text. */
function decoded(hit: Hit): string {
  const parts = [hit.url, hit.raw, JSON.stringify(hit.payload), ...Object.entries(hit.headers).flat()];
  return parts.map((p) => `${p}\n${safeDecode(p)}`).join('\n');
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** The checks every send must pass, whatever triggered it. */
function expectClean(hit: Hit, forbidden: string[]) {
  expect(hit.method).toBe('POST');
  expect(hit.url).toBe(COLLECT);
  expect(hit.type).toBe('event');
  const p = hit.payload;
  const keys = Object.keys(p).sort();
  expect(keys).toEqual(p.name === undefined ? PAYLOAD_KEYS : [...PAYLOAD_KEYS, 'data', 'name'].sort());
  expect(p.website).toBe(WEBSITE_ID);
  expect(p.hostname).toBe('toolspace.tech');
  expect(p.url).toMatch(/^\/[a-z0-9/-]*$/); // a path from the build: no origin, ? or #
  expect(p.screen).toMatch(/^\d+x\d+$/);
  expect(p.referrer === '' || /^https:\/\/[a-z0-9.-]+\/$/.test(p.referrer as string)).toBe(true);
  if (p.name !== undefined) {
    expect(p.name).toBe('tool-run');
    expect(Object.keys(p.data as object)).toEqual(['tool']);
  }
  // Headers: what the tracker sets, plus the browser's own; never a referrer or cookie
  expect(hit.headers['referer']).toBeUndefined();
  expect(hit.headers['cookie']).toBeUndefined();
  for (const h of HEADERS_FROM_TRACKER.slice(0, 3)) expect(hit.headers[h]).toBeTruthy();
  expect(hit.headers['x-umami-website-id']).toBe(WEBSITE_ID);
  expect(hit.headers['x-umami-hostname']).toBe('toolspace.tech');
  const everything = decoded(hit);
  for (const s of forbidden) expect(everything, `telemetry contains "${s.slice(0, 40)}"`).not.toContain(s);
}

async function typeJson(page: Page, text: string) {
  const editor = page.getByLabel('JSON input', { exact: true });
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  if (text) await page.keyboard.insertText(text);
  else await page.keyboard.press('Backspace');
}

/** Waits past the settle time, so a tool-run that was going to fire has fired. */
const settle = (page: Page) => page.waitForTimeout(SETTLE_MS + 1500);

test.describe('analytics', () => {
  test('counts pageviews and tool runs with only allowlisted fields, through share links and navigation', async ({ context, page, baseURL }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const t = await production(context, baseURL!);

    // 1. JSON formatter: a canary input produces one tool-run, and only one while the result is unchanged
    await page.goto(`${PROD}/json-formatter/?utm_source=${CANARY.query}`);
    await expect.poll(() => t.views().length).toBe(1);
    expect(t.views()[0]!.payload.url).toBe('/json-formatter/');
    expect(t.views()[0]!.payload.title).toBe(await page.title());

    const json = `{"secret":"${CANARY.json}","n":[1,2,3]}`;
    await typeJson(page, json);
    await expect.poll(() => t.runs().length, { timeout: SETTLE_MS + 5000 }).toBe(1);
    expect(t.runs()[0]!.payload.data).toEqual({ tool: 'json-formatter' });
    expect(t.runs()[0]!.payload.url).toBe('/json-formatter/');
    // Same result again: whitespace that formats the same, then a click that changes nothing
    await page.keyboard.insertText('  ');
    await page.getByLabel('JSON input', { exact: true }).click();
    await settle(page);
    expect(t.runs()).toHaveLength(1);

    // 2. Its share link carries the input after the #; opening it is a pageview, not a tool-run
    await page.getByRole('button', { name: 'Share' }).click();
    const jsonLink = await page.getByLabel('Link with your input').inputValue();
    expect(jsonLink).toMatch(/^https:\/\/toolspace\.tech\/json-formatter\/#s=.+/);
    const jsonFragment = jsonLink.split('#')[1]!;
    const shared = await context.newPage();
    await shared.goto(jsonLink);
    await expect.poll(() => t.views().length).toBe(2);
    await expect(shared.getByLabel('JSON input', { exact: true })).toContainText(CANARY.json);
    await settle(shared);
    expect(t.runs()).toHaveLength(1);

    // 3. Diff checker: compare two canary texts, share, open the link, then navigate away from it
    await shared.goto(`${PROD}/diff-checker/`);
    await shared.getByLabel('Original text').fill(`left ${CANARY.original}\nsame\n`);
    await shared.getByLabel('Changed text').fill(`right ${CANARY.changed}\nsame\n`);
    await expect(shared.getByLabel('Change summary')).toBeVisible();
    await expect.poll(() => t.runs().length, { timeout: SETTLE_MS + 5000 }).toBe(2);
    expect(t.runs()[1]!.payload.data).toEqual({ tool: 'diff-checker' });

    await shared.getByRole('button', { name: 'Share' }).click();
    await expect(shared).toHaveURL(/#.+/);
    const diffLink = shared.url();
    const diffFragment = diffLink.split('#')[1]!;
    const viewsBefore = t.views().length;
    const opened = await context.newPage();
    await opened.goto(diffLink.replace('/diff-checker/', `/diff-checker/?ref=${CANARY.query}`));
    await expect.poll(() => t.views().length).toBe(viewsBefore + 1);
    await settle(opened);
    expect(t.runs()).toHaveLength(2); // restored input isn't a run

    await opened.getByRole('link', { name: 'About', exact: true }).first().click();
    await expect(opened).toHaveURL(`${PROD}/about/`);
    await expect.poll(() => t.views().length).toBe(viewsBefore + 2);
    const about = t.views().at(-1)!;
    expect(about.payload.url).toBe('/about/');
    expect(about.payload.referrer).toBe(''); // the page before (holding the share link) is not reported

    // 4. Arriving from another site: only that site's origin is kept
    const external = await context.newPage();
    await external.goto(`${PROD}/json-viewer/`, { referer: `https://example.org/post/${CANARY.referrer}?q=${CANARY.referrer}` });
    await expect.poll(() => t.views().at(-1)?.payload.url).toBe('/json-viewer/');
    expect(t.views().at(-1)!.payload.referrer).toBe('https://example.org/');

    // Every send: allowlisted fields only, and no input, query, fragment or referrer path anywhere
    // (? and # are checked on url and referrer above; the browser's own sec-ch-ua-mobile header is "?0")
    const forbidden = [...Object.values(CANARY), jsonFragment, diffFragment, '#s=', '"secret"', 'same\\n'];
    expect(t.hits.length).toBeGreaterThanOrEqual(7);
    for (const hit of t.hits) expectClean(hit, forbidden);
    // The cache header is the token our mock issued, echoed back, not anything from the page
    const later = t.hits.slice(1).map((h) => h.headers['x-umami-cache']);
    expect(later.every((v) => v === undefined || v === 'mock-cache-token')).toBe(true);
    expect(t.unexpected).toEqual([]);
  });

  test('errors, empty input and unchanged results are not counted as tool runs', async ({ context, page, baseURL }) => {
    const t = await production(context, baseURL!);
    await page.goto(`${PROD}/json-formatter/`);
    await expect.poll(() => t.views().length).toBe(1);

    await typeJson(page, `{"broken": ${CANARY.invalid}`); // invalid JSON: an error, not a result
    await settle(page);
    await typeJson(page, ''); // empty
    await settle(page);
    expect(t.runs()).toHaveLength(0);

    await typeJson(page, '{"a":1}');
    await expect.poll(() => t.runs().length, { timeout: SETTLE_MS + 5000 }).toBe(1);
    await typeJson(page, '{ "a" : 1 }'); // formats to the same output
    await settle(page);
    await typeJson(page, `{"broken": ${CANARY.invalid}`);
    await settle(page);
    expect(t.runs()).toHaveLength(1);

    // Typing quickly through several valid states counts once, after it settles
    await typeJson(page, '');
    for (const ch of '{"b":12345}') {
      await page.keyboard.insertText(ch);
      await page.waitForTimeout(80);
    }
    await expect.poll(() => t.runs().length, { timeout: SETTLE_MS + 5000 }).toBe(2);
    await settle(page);
    expect(t.runs()).toHaveLength(2);
    for (const hit of t.hits) expectClean(hit, [CANARY.invalid, '12345', '"b"']);
    expect(t.unexpected).toEqual([]);
  });

  test('sends nothing when the browser has Do Not Track on', async ({ context, page, baseURL }) => {
    await context.addInitScript(() => Object.defineProperty(Navigator.prototype, 'doNotTrack', { get: () => '1' }));
    const t = await production(context, baseURL!);
    await page.goto(`${PROD}/json-formatter/`);
    await expect.poll(() => page.evaluate(() => typeof (window as { umami?: unknown }).umami)).toBe('object');
    await typeJson(page, '{"a":1}');
    await settle(page);
    expect(t.hits).toEqual([]);
    expect(t.unexpected).toEqual([]);
  });

  test('sends nothing outside toolspace.tech', async ({ context, page }) => {
    // The ordinary test server (localhost), with the collection endpoint mocked in case anything tried
    const hits: string[] = [];
    await context.route(`${COLLECT}*`, (route) => {
      hits.push(route.request().postData() ?? '');
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/json-formatter/');
    await expect.poll(() => page.evaluate(() => typeof (window as { umami?: unknown }).umami)).toBe('object');
    await typeJson(page, '{"a":1}');
    await settle(page);
    expect(hits).toEqual([]);
  });
});
