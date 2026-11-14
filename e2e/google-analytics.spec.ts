import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * Google Analytics behind the consent banner (src/lib/consent.ts),
 * end to end against the production build with its Content Security Policy.
 *
 * Analytics only runs on toolspace.tech, so these tests serve the local build AS
 * https://toolspace.tech inside the browser. Google's real gtag.js is fetched
 * (once per worker), so the tracking under test is the real thing; every
 * request it makes to a Google collection endpoint is answered by a mock and
 * recorded, so no hit reaches the real analytics property. Any other outside
 * request is aborted and reported. Service workers are blocked so every
 * request passes the routes.
 */

const PROD = 'https://toolspace.tech';
const GTAG = 'https://www.googletagmanager.com/gtag/js';
const ID = 'G-F1P7CTRGH3';
const SETTLE_MS = 2000; // TOOL_RUN_SETTLE_MS in src/lib/analytics.ts
/** gtag.js batches events for a few seconds before sending. */
const FLUSH_MS = 15_000;

/** Distinct strings put into inputs, a query string, a fragment and a referrer; none may reach Google. */
const CANARY = {
  json: 'cnryJsonQ7xK2',
  invalid: 'cnryBadW4pZ9',
  original: 'cnryLeftM3vB8',
  changed: 'cnryRightT6nC1',
  query: 'cnryQueryR2dF5',
  referrer: 'cnryRefH8sL4',
  search: 'cnrySearchS3kP0',
  rule: 'cnryRuleV5gH2',
  mdLink: 'cnryMdLinkA8',
  mdFile: 'cnryMdFileB9',
};

type Hit = { url: string; method: string; headers: Record<string, string>; body: string };
type GaEvent = Record<string, string>;

test.use({ serviceWorkers: 'block' });

let gtagScript: Buffer | undefined;

const isGoogle = (host: string) => /(^|\.)(google|googletagmanager|google-analytics|doubleclick|googlesyndication|gstatic)\.[a-z.]+$/.test(host);

/** Serves the local build as https://toolspace.tech, serves the real gtag.js, and records every Google request. */
async function production(context: BrowserContext, baseURL: string) {
  const google: Hit[] = [];
  const unexpected: string[] = [];
  const violations: string[] = [];
  await context.exposeBinding('__cspViolation', (_src, v: string) => void violations.push(v));
  await context.addInitScript(() =>
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as unknown as { __cspViolation: (v: string) => void }).__cspViolation(`${e.violatedDirective} ${e.blockedURI}`),
    ),
  );
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin === PROD) {
      const response = await route.fetch({ url: `${baseURL}${url.pathname}${url.search}` });
      return route.fulfill({ response });
    }
    if (url.origin === baseURL) return route.continue();
    if (isGoogle(url.hostname)) {
      google.push({ url: req.url(), method: req.method(), headers: await req.allHeaders(), body: req.postData() ?? '' });
      if (`${url.origin}${url.pathname}` === GTAG) {
        gtagScript ??= await (await route.fetch()).body();
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: gtagScript });
      }
      return route.fulfill({ status: 204, body: '' });
    }
    // Umami counts run alongside GA on every page (covered by e2e/umami.spec.ts): answered, not checked here
    if (url.origin === 'https://gateway.umami.is') {
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: '{}' });
    }
    unexpected.push(`${req.method()} ${req.url()}`);
    return route.abort();
  });

  const collects = () => google.filter((h) => new URL(h.url).pathname.endsWith('/g/collect'));
  /** Every event sent, with the request's shared parameters merged in. */
  const events = (): GaEvent[] =>
    collects().flatMap((h) => {
      const shared = Object.fromEntries(new URL(h.url).searchParams);
      const lines = h.body.split('\n').filter((l) => l.trim());
      if (lines.length === 0) return shared.en ? [shared] : [];
      return lines.map((l) => ({ ...shared, ...Object.fromEntries(new URLSearchParams(l)) }));
    });
  const named = (en: string) => events().filter((e) => e.en === en);
  return { google, unexpected, violations, collects, events, named };
}

const banner = (page: Page) => page.getByRole('region', { name: 'Analytics cookies' });

/** Everything a Google request carried, decoded every way it could hide text. */
function decoded(hit: Hit): string {
  const parts = [hit.url, hit.body, ...Object.entries(hit.headers).flat()];
  return parts.map((p) => `${p}\n${safeDecode(p)}\n${safeDecode(safeDecode(p))}`).join('\n');
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
}

function expectNoLeak(hits: Hit[], forbidden: string[]) {
  for (const hit of hits) {
    const everything = decoded(hit);
    for (const s of forbidden) expect(everything, `Google request contains "${s.slice(0, 40)}": ${hit.url.slice(0, 200)}`).not.toContain(s);
  }
}

/** A page address GA may see: origin + path, plus only utm_* campaign tags; never # or another query parameter. */
const PAGE_LOCATION = /^https:\/\/toolspace\.tech\/[a-z0-9/-]*(\?utm_[a-z]+=[^&#]*(&utm_[a-z]+=[^&#]*)*)?$/;

/**
 * The page fields of every event: a clean page address, an outside origin or no referrer, and our own
 * events with only their fixed parameters. GA's own events (scroll, user_engagement, form_start ...) are
 * allowed; their contents are checked for canaries by expectNoLeak.
 */
function expectCleanEvents(events: GaEvent[]) {
  expect(events.length).toBeGreaterThan(0);
  for (const e of events) {
    expect(e.tid).toBe(ID);
    expect(e.dl).toMatch(PAGE_LOCATION);
    expect((e.dr ?? '') === '' || /^https:\/\/[a-z0-9.-]+\/$/.test(e.dr!)).toBe(true);
    const custom = Object.keys(e).filter((k) => /^(ep|epn|up|upn)\./.test(k));
    if (e.en === 'page_view') expect(custom).toEqual([]);
    if (e.en === 'tool_run') {
      expect(custom).toEqual(['ep.tool']);
      expect(e['ep.tool']).toMatch(/^[a-z0-9-]+$/);
    }
  }
}

async function typeJson(page: Page, text: string) {
  const editor = page.getByLabel('JSON input', { exact: true });
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  if (text) await page.keyboard.insertText(text);
  else await page.keyboard.press('Backspace');
}

/** Waits past the settle time, so a tool run that was going to be counted has been. */
const settle = (page: Page) => page.waitForTimeout(SETTLE_MS + 1500);

const gaCookies = async (context: BrowserContext) => (await context.cookies()).filter((c) => c.name.startsWith('_ga'));

test.describe('analytics consent', () => {
  test('no choice made: the banner shows, and using a tool sends nothing to Google', async ({ context, page, baseURL }) => {
    const t = await production(context, baseURL!);
    await page.goto(`${PROD}/json-formatter/`);
    await expect(banner(page)).toBeVisible();
    await typeJson(page, `{"secret":"${CANARY.json}"}`);
    await settle(page);
    await page.mouse.wheel(0, 3000);
    await page.waitForTimeout(1000);
    expect(t.google).toEqual([]);
    expect(await gaCookies(context)).toEqual([]);
    expect(await page.evaluate(() => typeof (window as { gtag?: unknown }).gtag)).toBe('undefined');

    // Control: the same harness does see GA once the visitor accepts
    await banner(page).getByRole('button', { name: 'Accept' }).click();
    await expect.poll(() => t.named('page_view').length, { timeout: FLUSH_MS }).toBe(1);
    expect(t.unexpected).toEqual([]);
    expect(t.violations).toEqual([]);
  });

  test('Reject: nothing is sent, and the choice persists after a reload', async ({ context, page, baseURL }) => {
    const t = await production(context, baseURL!);
    await page.goto(`${PROD}/json-formatter/`);
    await banner(page).getByRole('button', { name: 'Reject' }).click();
    await expect(banner(page)).toBeHidden();
    await typeJson(page, '{"a":1}');
    await settle(page);

    await page.reload();
    await expect(page.getByLabel('JSON input', { exact: true })).toBeVisible();
    await expect(banner(page)).toBeHidden();
    await typeJson(page, '{"b":2}');
    await settle(page);
    expect(t.google).toEqual([]);
    expect(await gaCookies(context)).toEqual([]);

    // Control: changing the choice from the footer turns GA on
    await page.getByRole('button', { name: 'Cookie settings' }).click();
    await banner(page).getByRole('button', { name: 'Accept' }).click();
    await expect.poll(() => t.named('page_view').length, { timeout: FLUSH_MS }).toBe(1);
    expect(t.unexpected).toEqual([]);
  });

  test('Accept: one page_view, one tool_run per successful run, nothing for a failed one', async ({ context, page, baseURL }) => {
    test.setTimeout(90_000);
    const t = await production(context, baseURL!);
    await page.goto(`${PROD}/json-formatter/?q=${CANARY.query}&utm_source=x#frag-${CANARY.query}`);
    await banner(page).getByRole('button', { name: 'Accept' }).click();
    await expect(banner(page)).toBeHidden();

    await expect.poll(() => t.named('page_view').length, { timeout: FLUSH_MS }).toBe(1);
    const view = t.named('page_view')[0]!;
    expect(view.dl).toBe(`${PROD}/json-formatter/?utm_source=x`); // campaign tags are kept; ?q= and # are not
    expect(view.dt).toBe(await page.locator('meta[property="og:title"]').getAttribute('content'));
    expect(view.dr).toBe('');
    expect(t.google.filter((h) => h.url.startsWith(GTAG))).toHaveLength(1);
    expect((await gaCookies(context)).length).toBeGreaterThan(0);

    // A successful run: exactly one tool_run, with only the static slug
    await typeJson(page, `{"secret":"${CANARY.json}","n":[1,2,3]}`);
    await expect.poll(() => t.named('tool_run').length, { timeout: SETTLE_MS + FLUSH_MS }).toBe(1);
    expect(t.named('tool_run')[0]!['ep.tool']).toBe('json-formatter');

    // A failing run (invalid JSON), then the same valid result again: nothing more
    await typeJson(page, `{"broken": ${CANARY.invalid}`);
    await settle(page);
    await typeJson(page, `{"secret":"${CANARY.json}","n":[1,2,3]}`);
    await settle(page);
    await page.mouse.wheel(0, 4000);
    await page.waitForTimeout(FLUSH_MS / 2);
    expect(t.named('tool_run')).toHaveLength(1);
    expect(t.named('page_view')).toHaveLength(1);

    expectCleanEvents(t.events());
    expectNoLeak(t.google, [...Object.values(CANARY), '"secret"', '#frag']);
    expect(t.unexpected).toEqual([]);
    expect(t.violations).toEqual([]);
  });

  test('Revoke: every _ga cookie is deleted and nothing more is sent', async ({ context, page, baseURL }) => {
    test.setTimeout(90_000);
    const t = await production(context, baseURL!);
    await page.goto(`${PROD}/json-formatter/`);
    await banner(page).getByRole('button', { name: 'Accept' }).click();
    await expect.poll(() => t.named('page_view').length, { timeout: FLUSH_MS }).toBe(1);
    await expect.poll(async () => (await gaCookies(context)).length).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Cookie settings' }).click();
    await banner(page).getByRole('button', { name: 'Reject' }).click();
    expect(await gaCookies(context)).toEqual([]);
    const before = t.google.length;

    await typeJson(page, '{"after":"revoke"}');
    await settle(page);
    await page.mouse.wheel(0, 4000);
    await page.waitForTimeout(FLUSH_MS / 2);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(1000);
    expect(t.google.slice(before)).toEqual([]);
    expect(await gaCookies(context)).toEqual([]);

    // And on the next page load, nothing loads at all
    await page.goto(`${PROD}/json-viewer/`);
    await page.waitForTimeout(2000);
    expect(t.google.slice(before)).toEqual([]);
    expect(await gaCookies(context)).toEqual([]);
    expect(t.unexpected).toEqual([]);
  });

  test('Do Not Track + Accept: nothing loads or is sent', async ({ context, page, baseURL }) => {
    await context.addInitScript(() => Object.defineProperty(Navigator.prototype, 'doNotTrack', { get: () => '1' }));
    const t = await production(context, baseURL!);
    await page.goto(`${PROD}/json-formatter/`);
    await banner(page).getByRole('button', { name: 'Accept' }).click();
    await typeJson(page, '{"a":1}');
    await settle(page);
    await page.reload();
    await page.waitForTimeout(2000);
    expect(t.google).toEqual([]);
    expect(await gaCookies(context)).toEqual([]);
    expect(t.unexpected).toEqual([]);
  });

  test('leaks: canary input, share links, a canary query, forms, user links, navigation and a referrer never reach Google', async ({ context, page, baseURL }) => {
    test.setTimeout(180_000);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const t = await production(context, baseURL!);

    // A search-style query with a canary (GA's site search reads the real address bar), plus a campaign tag
    await page.goto(`${PROD}/json-formatter/?q=${CANARY.search}&ref=${CANARY.query}&utm_source=newsletter`);
    await banner(page).getByRole('button', { name: 'Accept' }).click();
    await expect.poll(() => t.named('page_view').length, { timeout: FLUSH_MS }).toBe(1);
    expect(t.named('page_view')[0]!.dl).toBe(`${PROD}/json-formatter/?utm_source=newsletter`);
    await expect(page).toHaveURL(`${PROD}/json-formatter/?utm_source=newsletter`); // the canary query left the address bar

    // A valid canary input, then its share link
    await typeJson(page, `{"secret":"${CANARY.json}","n":[1,2,3]}`);
    await expect.poll(() => t.named('tool_run').length, { timeout: SETTLE_MS + FLUSH_MS }).toBe(1);
    await page.getByRole('button', { name: 'Share' }).click();
    const jsonLink = await page.getByLabel('Link with your input').inputValue();
    expect(jsonLink).toMatch(/^https:\/\/toolspace\.tech\/json-formatter\/#s=.+/);

    // Open the share link (with a canary query added): a page view for the bare path, no tool run
    const shared = await context.newPage();
    await shared.goto(jsonLink.replace('/#', `/?ref=${CANARY.query}#`));
    await expect(shared.getByLabel('JSON input', { exact: true })).toContainText(CANARY.json);
    await expect.poll(() => t.named('page_view').length, { timeout: FLUSH_MS }).toBe(2);
    await settle(shared);

    // Diff checker: compare canaries, share (the texts go into the address bar's #), then use the ignore-rule form
    await shared.goto(`${PROD}/diff-checker/`);
    await expect.poll(() => t.named('page_view').length, { timeout: FLUSH_MS }).toBe(3);
    await shared.getByLabel('Original text').fill(`left ${CANARY.original}\nsame\n`);
    await shared.getByLabel('Changed text').fill(`right ${CANARY.changed}\nsame\n`);
    await expect(shared.getByLabel('Change summary')).toBeVisible();
    await expect.poll(() => t.named('tool_run').length, { timeout: SETTLE_MS + FLUSH_MS }).toBe(2);
    await shared.getByRole('button', { name: 'Share' }).click();
    await expect(shared).toHaveURL(/#.+/);
    const diffLink = shared.url();
    await shared.getByRole('button', { name: /ignore/i }).first().click();
    const ruleInput = shared.getByPlaceholder('e.g. build-\\d+');
    await ruleInput.fill(CANARY.rule);
    await ruleInput.press('Enter');
    await expect.poll(() => t.named('form_start').length, { timeout: FLUSH_MS }).toBeGreaterThan(0);
    expect(t.named('form_start')[0]!['ep.form_destination']).toBe(`${PROD}/diff-checker/`);

    // Open the diff link, then navigate from it
    const opened = await context.newPage();
    await opened.goto(diffLink);
    await expect(opened.getByLabel('Original text')).toContainText(CANARY.original);
    await expect.poll(() => t.named('page_view').length, { timeout: FLUSH_MS }).toBe(4);
    await opened.getByRole('link', { name: 'About', exact: true }).first().click();
    await expect(opened).toHaveURL(`${PROD}/about/`);
    await expect.poll(() => t.named('page_view').length, { timeout: FLUSH_MS }).toBe(5);

    // Markdown preview: the visitor's own links (an outbound link and a file) are clicked; they still open
    await opened.goto(`${PROD}/markdown-preview/`);
    await expect.poll(() => t.named('page_view').length, { timeout: FLUSH_MS }).toBe(6);
    const md = opened.getByLabel('Markdown', { exact: true });
    await md.click();
    await opened.keyboard.press('ControlOrMeta+a');
    await opened.keyboard.insertText(`[out](https://example.org/${CANARY.mdLink}?x=${CANARY.mdLink}) and [file](https://example.org/${CANARY.mdFile}.pdf)`);
    const links = opened.locator('.markdown-body a');
    await expect(links).toHaveCount(2);
    const popup = context.waitForEvent('page');
    await links.nth(0).click({ modifiers: ['ControlOrMeta'] });
    expect((await popup).url()).toContain(CANARY.mdLink); // the link works
    await links.nth(1).click({ modifiers: ['ControlOrMeta'] });
    await links.nth(0).click({ button: 'middle' });
    await expect.poll(() => t.named('tool_run').length, { timeout: SETTLE_MS + FLUSH_MS }).toBe(3);

    // Arriving from another site with canaries in its address: only its origin is reported
    const external = await context.newPage();
    await external.goto(`${PROD}/json-viewer/`, { referer: `https://example.org/post/${CANARY.referrer}?q=${CANARY.referrer}` });
    await expect.poll(() => t.named('page_view').length, { timeout: FLUSH_MS }).toBe(7);
    expect(t.named('page_view').at(-1)!.dr).toBe('https://example.org/');
    await external.mouse.wheel(0, 4000);
    await settle(external);
    for (const p of context.pages()) await p.close({ runBeforeUnload: true });
    await new Promise((r) => setTimeout(r, 1500));

    expect(t.named('page_view').map((e) => e.dl).sort()).toEqual(
      [`${PROD}/about/`, `${PROD}/diff-checker/`, `${PROD}/diff-checker/`, `${PROD}/json-formatter/`, `${PROD}/json-formatter/?utm_source=newsletter`, `${PROD}/json-viewer/`, `${PROD}/markdown-preview/`].sort(),
    );
    // The ignore rule changed the diff's result, so it counts as a second diff run
    expect(t.named('tool_run').map((e) => e['ep.tool'])).toEqual(['json-formatter', 'diff-checker', 'diff-checker', 'markdown-preview']);
    expect(t.named('view_search_results')).toEqual([]);
    expect(t.events().filter((e) => e.en === 'click' || e.en === 'file_download')).toEqual([]);

    expectCleanEvents(t.events());
    const fragments = [jsonLink.split('#')[1]!, diffLink.split('#')[1]!];
    expectNoLeak(t.google, [...Object.values(CANARY), ...fragments, '#s=', '"secret"', 'same\n', '.pdf']);
    expect(t.unexpected.filter((u) => !u.includes('//example.org/'))).toEqual([]);
    expect(t.violations).toEqual([]);
  });

  test("permitted GA events still send: page_view, tool_run, GA's own session and engagement events", async ({ context, page, baseURL }) => {
    test.setTimeout(90_000);
    const t = await production(context, baseURL!);
    await page.goto(`${PROD}/json-formatter/`);
    await banner(page).getByRole('button', { name: 'Accept' }).click();
    await expect.poll(() => t.named('page_view').length, { timeout: FLUSH_MS }).toBe(1);
    // GA marks the first hit itself (first visit, session start); nothing of ours rewrites these
    expect(t.named('page_view')[0]).toMatchObject({ _fv: '1', _ss: '1' });
    await typeJson(page, '{"a":1}');
    await expect.poll(() => t.named('tool_run').length, { timeout: SETTLE_MS + FLUSH_MS }).toBe(1);
    await page.mouse.wheel(0, 6000);
    await expect.poll(() => t.named('scroll').length, { timeout: FLUSH_MS }).toBe(1);
    // Engagement time is reported when the tab is hidden (automated tabs never hide, so simulate it)
    await page.waitForTimeout(3000);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('pagehide'));
    });
    await expect.poll(() => t.named('user_engagement').length, { timeout: 5000 }).toBeGreaterThan(0);
    expect(Number(t.named('user_engagement')[0]!._et)).toBeGreaterThan(0);
    expectCleanEvents(t.events());
  });

  test('loads nothing and shows no banner outside toolspace.tech', async ({ context, page }) => {
    const google: string[] = [];
    await context.route(/google|doubleclick/, (route) => {
      google.push(route.request().url());
      return route.abort();
    });
    await page.goto('/json-formatter/');
    await expect(page.getByLabel('JSON input', { exact: true })).toBeVisible();
    await expect(banner(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cookie settings' })).toHaveCount(0);
    await typeJson(page, '{"a":1}');
    await settle(page);
    expect(google).toEqual([]);
  });
});

test.describe('consent banner looks', () => {
  for (const [name, viewport] of [
    ['desktop', { width: 1440, height: 900 }],
    ['mobile', { width: 390, height: 844 }],
  ] as const) {
    test(`Accept and Reject are equally prominent (${name})`, async ({ context, page, baseURL }, info) => {
      await production(context, baseURL!);
      await page.setViewportSize(viewport);
      await page.goto(`${PROD}/json-formatter/`);
      const b = banner(page);
      await expect(b).toBeVisible();
      const accept = b.getByRole('button', { name: 'Accept' });
      const reject = b.getByRole('button', { name: 'Reject' });
      const [a, r] = [(await accept.boundingBox())!, (await reject.boundingBox())!];
      expect(Math.abs(a.width - r.width)).toBeLessThan(1);
      expect(Math.abs(a.height - r.height)).toBeLessThan(1);
      const style = (el: Element) => {
        const s = getComputedStyle(el);
        return [s.backgroundColor, s.color, s.fontSize, s.fontWeight, s.borderTopWidth, s.borderTopColor, s.borderRadius].join('|');
      };
      expect(await accept.evaluate(style)).toBe(await reject.evaluate(style));
      const file = process.env.CONSENT_SHOTS ? `${process.env.CONSENT_SHOTS}/banner-${name}.png` : info.outputPath(`banner-${name}.png`);
      await page.screenshot({ path: file });
    });
  }
});
