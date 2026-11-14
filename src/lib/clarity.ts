/**
 * Microsoft Clarity (heatmaps and session recordings), for every visitor on
 * the live site, with no banner.
 *
 * - Loaded once the page is idle (at most 2.5 s after load), only on
 *   toolspace.tech, and never when the browser sends Do Not Track. The Bing
 *   pixel Microsoft's tag adds is blocked by the Content Security Policy (no
 *   outside images), so no Bing cookies are set.
 * - Recordings would show page text, so the whole page is masked by default
 *   (data-clarity-mask on <body>) and only static parts are unmasked
 *   (data-clarity-unmask: header, sidebar, headings, guides, FAQs, footer).
 *   Tool inputs, outputs, popovers and toasts stay masked.
 * - Clarity records the full page address, and share links keep their input
 *   after the #, which Clarity has no option to drop. So it never starts on a
 *   page opened with a #, and stops for good (its requests dropped by the
 *   gate in src/lib/requestGate.ts) the moment the page puts a # in the
 *   address, as the diff checker's Share button does.
 */

import { installRequestGate } from './requestGate';

/** The Clarity project ID (clarity.microsoft.com → Settings → Overview). Empty: Clarity never loads. */
export const CLARITY_ID = 'zdhvx1n055';
/** Clarity only ever runs on the live site. */
export const CLARITY_SITE = 'toolspace.tech';

const CLARITY_HOST = /(^|\.)clarity\.ms$/;

/** Whether a URL points at one of Clarity's hosts. */
export function isClarityUrl(url: string): boolean {
  try {
    return CLARITY_HOST.test(new URL(url, typeof location === 'undefined' ? undefined : location.href).hostname);
  } catch {
    return false;
  }
}

type Clarity = ((...args: unknown[]) => void) & { q?: unknown[] };
type ClarityWindow = Window & { clarity?: Clarity };
const w = () => window as unknown as ClarityWindow;

const browser = typeof window !== 'undefined' && typeof document !== 'undefined';

/** True once this page has had a # in its address; read at load, before any script can clear it. */
let fragmentSeen = browser && location.hash.length > 1;
let started = false;

export const sawFragment = () => fragmentSeen;

function doNotTrack(): boolean {
  const nav = navigator as Navigator & { msDoNotTrack?: string };
  return nav.doNotTrack === '1' || nav.msDoNotTrack === '1' || (window as { doNotTrack?: string }).doNotTrack === '1';
}

/** Ends Clarity's session on this page; the gate drops anything it still sends. */
function stop() {
  fragmentSeen = true;
  w().clarity?.('consent', false);
  deleteClarityCookies();
}

/** Notices a # appearing in the address (Share links), however it gets there. */
function watchFragment() {
  const seen = () => {
    if (location.hash.length > 1 && !fragmentSeen) stop();
  };
  for (const name of ['pushState', 'replaceState'] as const) {
    const original = history[name].bind(history);
    history[name] = (data: unknown, unused: string, url?: string | URL | null) => {
      // Decided before the address changes, so nothing Clarity sends afterwards gets through
      if (url != null && new URL(String(url), location.href).hash.length > 1 && !fragmentSeen) stop();
      original(data, unused, url);
      seen();
    };
  }
  window.addEventListener('hashchange', seen);
}

function load() {
  if (fragmentSeen) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${CLARITY_ID}`;
  document.head.appendChild(script);
}

/** Starts Clarity once per page, if it's configured, on the live site, without Do Not Track or a #. */
export function startClarity() {
  if (!browser || started || !CLARITY_ID || location.hostname !== CLARITY_SITE || doNotTrack() || fragmentSeen) return;
  started = true;
  watchFragment();
  installRequestGate('clarity', isClarityUrl, () => !fragmentSeen);
  document.body.setAttribute('data-clarity-mask', 'True');
  const win = w();
  // The queue Microsoft's snippet sets up; calls made before the script loads run once it does
  win.clarity ??= Object.assign((...args: unknown[]) => void (win.clarity!.q ??= []).push(args), {});
  const page = document.getElementById('root')?.dataset.page;
  if (page) win.clarity('set', 'page', page);
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(load, { timeout: 2500 });
  else setTimeout(load, 1500);
}

export function deleteClarityCookies() {
  if (!browser) return;
  const names = document.cookie
    .split(';')
    .map((c) => c.split('=')[0]!.trim())
    .filter((n) => n === '_clck' || n === '_clsk');
  const parts = location.hostname.split('.');
  const domains = [''];
  for (let i = 0; i < parts.length - 1; i++) {
    const d = parts.slice(i).join('.');
    domains.push(`; domain=${d}`, `; domain=.${d}`);
  }
  for (const name of names) for (const domain of domains) document.cookie = `${name}=; Max-Age=0; path=/${domain}`;
}

/** A tool produced a result: tag the session with the tool's ID and record the event. */
export function clarityToolRun(tool: string) {
  if (!started || fragmentSeen || !/^[a-z0-9-]{1,40}$/.test(tool)) return;
  w().clarity?.('set', 'tool', tool);
  w().clarity?.('event', 'tool_run');
}
