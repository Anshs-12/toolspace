/** Umami Cloud: the site's ID, and the endpoint public/umami.js sends page views to. */
export const UMAMI_WEBSITE_ID = 'bfdd0fe7-099d-43ab-b329-2cee9f21a87f';
export const UMAMI_HOST = 'https://gateway.umami.is';

/**
 * Production Content Security Policy, injected into index.html at build time and
 * quoted on the page. `connect-src` allows one destination, Umami's endpoint for
 * anonymous page-view counts, and blocks every other fetch/XHR/WebSocket, so
 * pasted text cannot be sent to any server. Scripts load only from this site.
 * 'wasm-unsafe-eval' lets the code beautifier compile its bundled WebAssembly
 * formatters; it allows no other kind of eval and no network access.
 */
export const CSP_DIRECTIVES = [
  "default-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  // The web app manifest (public/site.webmanifest), which lists the icons
  "manifest-src 'self'",
  "font-src 'self'",
  `connect-src ${UMAMI_HOST}`,
  "base-uri 'none'",
  "form-action 'none'",
];

export const CSP = CSP_DIRECTIVES.join('; ');
