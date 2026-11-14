/**
 * A switch on a group of outside hosts: while `isActive()` is false, any
 * request from this page to a URL `matches` accepts is dropped; while it is
 * true, requests pass through unchanged. Installed once per name.
 *
 * Used by src/lib/clarity.ts to cut Clarity off for good once the page has had
 * a # in its address (share links keep input there). It wraps fetch,
 * sendBeacon and XMLHttpRequest; outside images and frames are already
 * blocked by the Content Security Policy.
 */
export function installRequestGate(name: string, matches: (url: string) => boolean, isActive: () => boolean) {
  const w = window as Window & { __toolspaceGates?: Set<string> };
  w.__toolspaceGates ??= new Set();
  if (w.__toolspaceGates.has(name)) return;
  w.__toolspaceGates.add(name);
  const blocked = (url: string) => matches(url) && !isActive();

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
