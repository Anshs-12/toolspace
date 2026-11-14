/**
 * A consent switch on Google requests, not a filter: while analytics isn't
 * active (no choice yet, rejected, revoked, Do Not Track, or not the live
 * site), any request from this page to a Google analytics or ads host is
 * dropped. While it is active, requests pass through unchanged.
 *
 * Why it exists: rejecting after accepting sets ga-disable and denies consent,
 * but gtag.js still sends hits it had already queued (seen in testing: a
 * scroll event sent after Reject). This stops those.
 *
 * It wraps fetch, sendBeacon and XMLHttpRequest, the ways gtag.js sends hits.
 * gtag.js's other transports (an <img> pixel, an iframe) are blocked by the
 * Content Security Policy, which allows no outside images or frames.
 */

const GOOGLE_HOST =
  /(^|\.)(google-analytics\.com|analytics\.google\.com|doubleclick\.net|googletagmanager\.com|google\.com|googlesyndication\.com|googleadservices\.com|[a-z-]+\.goog)$/;

/** Whether a URL points at one of Google's analytics or ads hosts. */
export function isGoogleUrl(url: string): boolean {
  try {
    return GOOGLE_HOST.test(new URL(url, typeof location === 'undefined' ? undefined : location.href).hostname);
  } catch {
    return false;
  }
}

/** Installs the switch once per page. `isActive` is read at send time. */
export function installSendGate(isActive: () => boolean) {
  const w = window as Window & { __toolspaceGaGate?: boolean };
  if (w.__toolspaceGaGate) return;
  w.__toolspaceGaGate = true;
  const blocked = (url: string) => isGoogleUrl(url) && !isActive();

  const fetch0 = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return blocked(url) ? Promise.resolve(new Response(null, { status: 204 })) : fetch0(input, init);
  };

  if (typeof navigator.sendBeacon === 'function') {
    const beacon0 = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => (blocked(String(url)) ? true : beacon0(url, data));
  }

  const open0 = XMLHttpRequest.prototype.open;
  const send0 = XMLHttpRequest.prototype.send;
  const urls = new WeakMap<XMLHttpRequest, string>();
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    urls.set(this, String(url));
    return (open0 as (...a: unknown[]) => void).call(this, method, url, ...rest);
  } as typeof XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    if (blocked(urls.get(this) ?? '')) return;
    return send0.call(this, body);
  };
}
