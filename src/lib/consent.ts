/**
 * Google Analytics 4, behind an opt-in consent choice (basic consent mode).
 *
 * - Nothing from Google loads until the visitor clicks Accept: no gtag.js, no
 *   requests, no consent pings. Rejecting, or never choosing, keeps it that way.
 * - Only on the live site (toolspace.tech), and never when the browser sends Do
 *   Not Track, even after Accept.
 * - The choice is kept in this browser's localStorage and can be changed at any
 *   time from the footer or the About page. Rejecting after accepting turns GA
 *   off for the page (ga-disable, consent denied) and deletes every _ga cookie.
 * - What GA can see, set through its documented settings before gtag.js loads:
 *     page_location  origin + pathname, plus only the standard utm_* campaign
 *                    tags; never the #fragment, where share links keep input
 *     page_title     the page's static title from the build (og:title)
 *     page_referrer  another site's origin only, never a path or query
 *   and the address bar's query is reduced to those campaign tags before
 *   gtag.js loads, because GA's site-search event reads the real address bar.
 *   GA's own events (sessions, engagement, scroll, outbound clicks) run as
 *   normal. Page views are sent by hand (send_page_view: false), once per load.
 * - src/lib/gaGuard.ts drops Google requests whenever analytics isn't active
 *   (gtag.js otherwise sends hits it queued before a revoke). It never reads or
 *   changes a request while analytics is active.
 */

import { installSendGate } from './gaGuard';

export const GA_ID = 'G-F1P7CTRGH3';
export const ANALYTICS_HOST = 'toolspace.tech';
const STORAGE_KEY = 'toolspace-analytics-consent';
const DISABLE_KEY = `ga-disable-${GA_ID}`;

export type Choice = 'granted' | 'denied';

type Gtag = (...args: unknown[]) => void;
type GaWindow = Window & { dataLayer?: unknown[]; gtag?: Gtag } & Record<string, unknown>;
const w = () => window as unknown as GaWindow;

const browser = typeof window !== 'undefined' && typeof document !== 'undefined';

/** Analytics can only ever run on the live site. */
export function analyticsAvailable(): boolean {
  return browser && location.hostname === ANALYTICS_HOST;
}

export function doNotTrack(): boolean {
  if (!browser) return true;
  const nav = navigator as Navigator & { msDoNotTrack?: string };
  return nav.doNotTrack === '1' || nav.msDoNotTrack === '1' || (window as { doNotTrack?: string }).doNotTrack === '1';
}

export function readChoice(): Choice | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

/** Standard campaign tags, kept for GA's traffic-source reports; every other query parameter is dropped. */
const CAMPAIGN = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id'];

function campaignQuery(): string {
  const kept = new URLSearchParams();
  for (const [k, v] of new URLSearchParams(location.search)) if (CAMPAIGN.includes(k) && !kept.has(k)) kept.append(k, v);
  const q = kept.toString();
  return q ? `?${q}` : '';
}

function externalReferrer(): string {
  try {
    const r = new URL(document.referrer);
    return r.hostname !== location.hostname && (r.protocol === 'https:' || r.protocol === 'http:') ? `${r.origin}/` : '';
  } catch {
    return '';
  }
}

/** The page details GA is given; nothing from inputs, outputs, the #fragment or non-campaign query. */
export function pageFields(): { page_location: string; page_title: string; page_referrer: string } {
  const title = document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content ?? '';
  return { page_location: location.origin + location.pathname + campaignQuery(), page_title: title, page_referrer: externalReferrer() };
}

/** Removes non-campaign query parameters from the address bar (the site uses none), keeping the #fragment. */
function cleanAddressBar() {
  const q = campaignQuery();
  if (location.search !== q) history.replaceState(history.state, '', location.pathname + q + location.hash);
}

// ── Subscriptions, for the banner ─────────────────────────────────────────

const listeners = new Set<() => void>();
let bannerOpen = false;
const notify = () => listeners.forEach((l) => l());

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The banner shows until a choice is made, or when reopened from a settings control. */
export const isBannerOpen = () => bannerOpen || (analyticsAvailable() && readChoice() === null);

export function openConsentSettings() {
  bannerOpen = true;
  notify();
}

// ── Loading, sending and stopping ─────────────────────────────────────────

let loaded = false;
let pageViewSent = false;

function active(): boolean {
  return loaded && analyticsAvailable() && !doNotTrack() && readChoice() === 'granted' && w()[DISABLE_KEY] !== true;
}

function send(name: string, params: Record<string, string> = {}) {
  if (!active()) return;
  w().gtag?.('event', name, params);
}

/** Loads GA, if the visitor accepted and nothing rules it out. Safe to call repeatedly. */
export function startAnalytics() {
  if (!analyticsAvailable() || doNotTrack() || readChoice() !== 'granted') return;
  const win = w();
  win[DISABLE_KEY] = false;
  if (!loaded) {
    loaded = true;
    installSendGate(active);
    const page = pageFields();
    cleanAddressBar();
    win.dataLayer = win.dataLayer || [];
    // gtag.js reads the queue's arguments objects, as in Google's snippet
    win.gtag = function gtag() {
      win.dataLayer!.push(arguments);
    };
    const gtag = win.gtag;
    gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    gtag('consent', 'update', { analytics_storage: 'granted' });
    gtag('js', new Date());
    gtag('set', { ...page, allow_google_signals: false, allow_ad_personalization_signals: false });
    gtag('config', GA_ID, { ...page, send_page_view: false });
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);
  } else {
    win.gtag?.('consent', 'update', { analytics_storage: 'granted' });
  }
  if (!pageViewSent) {
    pageViewSent = true;
    send('page_view');
  }
}

/** Every cookie whose name starts with _ga, removed for this host and its parent domains. */
export function deleteGaCookies() {
  const names = document.cookie
    .split(';')
    .map((c) => c.split('=')[0]!.trim())
    .filter((n) => n.startsWith('_ga'));
  const parts = location.hostname.split('.');
  const domains = [''];
  for (let i = 0; i < parts.length - 1; i++) {
    const d = parts.slice(i).join('.');
    domains.push(`; domain=${d}`, `; domain=.${d}`);
  }
  for (const name of names) {
    for (const domain of domains) document.cookie = `${name}=; Max-Age=0; path=/${domain}`;
  }
}

function stopAnalytics() {
  const win = w();
  // Set first: once true, gtag.js sends nothing more from this page
  win[DISABLE_KEY] = true;
  if (loaded) win.gtag?.('consent', 'update', { analytics_storage: 'denied' });
  deleteGaCookies();
}

export function setChoice(choice: Choice) {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Storage unavailable: the choice applies to this page only
  }
  bannerOpen = false;
  if (choice === 'granted') startAnalytics();
  else stopAnalytics();
  notify();
}

/** Called once per page: resumes GA for a visitor who accepted before, or cleans up after one who didn't. */
export function initConsent() {
  if (!analyticsAvailable()) return;
  // Drops any Google request while analytics isn't active, including hits gtag.js queued before a revoke
  installSendGate(active);
  if (readChoice() === 'granted') startAnalytics();
  else deleteGaCookies();
}

/** A tool produced a successful result: count it with only the page's static tool ID. */
export function trackToolRun(tool: string) {
  if (/^[a-z0-9-]{1,40}$/.test(tool)) send('tool_run', { tool });
}
