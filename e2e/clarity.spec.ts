import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * Microsoft Clarity (src/lib/clarity.ts), end to end against the production
 * build with its Content Security Policy.
 *
 * Like e2e/umami.spec.ts, the build is served AS https://toolspace.tech.
 * Clarity's tag is answered with a copy of Microsoft's loader for this project
 * that loads the real clarity.js (fetched once per worker); every upload is
 * answered by a mock and recorded, so nothing reaches the real project. Umami
 * is answered and ignored here (its own spec covers it).
 *
 * Skipped until CLARITY_ID in src/lib/clarity.ts is set.
 */

const CLARITY_ID = /export const CLARITY_ID = '([^']*)'/.exec(readFileSync(new URL('../src/lib/clarity.ts', import.meta.url), 'utf8'))![1]!;
test.skip(!CLARITY_ID, 'CLARITY_ID is not set in src/lib/clarity.ts');

const PROD = 'https://toolspace.tech';
/** The clarity.js version Microsoft's tag loaded when this was written; the real file is fetched. */
const CLARITY_JS = 'https://scripts.clarity.ms/0.8.79-beta/clarity.js';
const UPLOAD = 'https://h.clarity.ms/collect';
/** Microsoft's loader, as www.clarity.ms/tag/<id> serves it (Bing pixel and all), pointing at the mock upload. */
const LOADER = `!function(c,l,a,r,i,t,y){function sync(){(new Image).src="https://c.clarity.ms/c.gif"}"complete"==document.readyState?sync():window.addEventListener("load",sync);if(a[c].v||a[c].t)return a[c]("event",c,"dup."+i.projectId);a[c].t=!0,(t=l.createElement(r)).async=!0,t.src="${CLARITY_JS}",(y=l.getElementsByTagName(r)[0]).parentNode.insertBefore(t,y),a[c]("start",i),a[c].q.unshift(a[c].q.pop())}("clarity",document,window,"script",{"projectId":"${CLARITY_ID}","upload":"${UPLOAD}","expire":365,"cookies":["_uetmsclkid","_uetvid","_clck"],"track":true,"content":true});`;
const CANARY = { json: 'cnryClarityJ4', original: 'cnryClarityL7', changed: 'cnryClarityR2' };

test.use({ serviceWorkers: 'block' });

let clarityJs: Buffer | undefined;

type Hit = { url: string; body: string };

async function production(context: BrowserContext, baseURL: string) {
  const clarity: string[] = [];
  const uploads: Hit[] = [];
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
    if (url.origin === PROD) return route.fulfill({ response: await route.fetch({ url: `${baseURL}${url.pathname}${url.search}` }) });
    if (url.origin === baseURL) return route.continue();
    if (/(^|\.)clarity\.ms$/.test(url.hostname)) {
      clarity.push(`${req.method()} ${url.origin}${url.pathname}`);
      if (url.pathname === `/tag/${CLARITY_ID}`) return route.fulfill({ status: 200, contentType: 'application/javascript', body: LOADER });
      if (req.url() === CLARITY_JS) {
        clarityJs ??= await (await route.fetch()).body();
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: clarityJs });
      }
      if (`${url.origin}${url.pathname}` === UPLOAD) {
        const raw = req.postDataBuffer() ?? Buffer.alloc(0);
        let body: string;
        try {
          body = gunzipSync(raw).toString('utf8');
        } catch {
          body = raw.toString('utf8');
        }
        uploads.push({ url: req.url(), body });
      }
      return route.fulfill({ status: 204, body: '' });
    }
    if (url.hostname === 'gateway.umami.is') {
      return route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: '' });
    }
    unexpected.push(`${req.method()} ${req.url()}`);
    return route.abort();
  });
  return { clarity, uploads, unexpected, violations };
}

const clarityCookies = async (context: BrowserContext) => (await context.cookies()).filter((c) => c.name === '_clck' || c.name === '_clsk');
/** Only the Bing pixel in Microsoft's loader may be blocked by the CSP. */
const expectOnlyBingPixelBlocked = (violations: string[]) => expect(violations.filter((v) => !v.startsWith('img-src https://c.clarity.ms/c.gif'))).toEqual([]);

async function typeJson(page: Page, text: string) {
  await page.getByLabel('JSON input', { exact: true }).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(text);
}

test.describe('Clarity', () => {
  test('starts with no banner and records a masked page', async ({ context, page, baseURL }) => {
    test.setTimeout(90_000);
    const t = await production(context, baseURL!);
    await page.goto(`${PROD}/json-formatter/`);
    await typeJson(page, `{"secret":"${CANARY.json}"}`);
    await expect.poll(() => t.uploads.length, { timeout: 30_000 }).toBeGreaterThan(0);
    await expect(page.getByRole('region', { name: /cookie/i })).toHaveCount(0);
    await expect(page.locator('body')).toHaveAttribute('data-clarity-mask', 'True');
    // The tool is masked: no unmasked ancestor between it and <body>
    expect(await page.locator('#tool').evaluate((el) => !!el.closest('[data-clarity-unmask]'))).toBe(false);
    await page.mouse.wheel(0, 2000);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(3000);
    // Control: the uploads are readable here, and the static heading (unmasked) is in them
    expect(t.uploads.some((u) => u.body.includes('JSON formatter'))).toBe(true);
    for (const u of t.uploads) expect(u.body, 'the canary input reached Clarity').not.toContain(CANARY.json);
    expect(t.unexpected).toEqual([]);
    expectOnlyBingPixelBlocked(t.violations);
  });

  test('never starts on a page opened with a #, such as a share link', async ({ context, page, baseURL }) => {
    const t = await production(context, baseURL!);
    await page.goto(`${PROD}/json-formatter/#s=whatever`);
    await page.waitForTimeout(5000);
    expect(t.clarity).toEqual([]);
    expect(t.unexpected).toEqual([]);
  });

  test('stops for good when the diff checker puts the texts in the address bar', async ({ context, page, baseURL }) => {
    test.setTimeout(90_000);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const t = await production(context, baseURL!);
    await page.goto(`${PROD}/diff-checker/`);
    await expect.poll(() => t.uploads.length, { timeout: 30_000 }).toBeGreaterThan(0);
    await page.getByLabel('Original text').fill(`left ${CANARY.original}\nsame\n`);
    await page.getByLabel('Changed text').fill(`right ${CANARY.changed}\nsame\n`);
    await page.getByRole('button', { name: 'Share' }).click();
    await expect(page).toHaveURL(/#.+/);
    const before = t.clarity.length;
    await page.mouse.wheel(0, 2000);
    await page.mouse.click(200, 200);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(8000);
    expect(t.clarity.slice(before)).toEqual([]);
    for (const u of t.uploads) for (const c of Object.values(CANARY)) expect(u.body).not.toContain(c);
    expect(await clarityCookies(context)).toEqual([]);
  });

  test('Do Not Track: Clarity never loads', async ({ context, page, baseURL }) => {
    await context.addInitScript(() => Object.defineProperty(Navigator.prototype, 'doNotTrack', { get: () => '1' }));
    const t = await production(context, baseURL!);
    await page.goto(`${PROD}/json-formatter/`);
    await page.waitForTimeout(5000);
    expect(t.clarity).toEqual([]);
  });

  test('never loads off the live site', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (r) => void (/clarity\.ms/.test(r.url()) && requests.push(r.url())));
    await page.goto('/json-formatter/');
    await page.waitForTimeout(4000);
    expect(requests).toEqual([]);
  });
});
