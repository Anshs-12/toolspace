/** Umami Cloud: the site's ID, and the endpoint public/umami.js sends page views to. */
export const UMAMI_WEBSITE_ID = 'bfdd0fe7-099d-43ab-b329-2cee9f21a87f';
export const UMAMI_HOST = 'https://gateway.umami.is';

/**
 * Production Content Security Policy, injected into index.html at build time and
 * quoted on the page. The only outside hosts are the two analytics services:
 * Umami's endpoint (cookieless counts; public/umami-config.js allowlists every
 * payload), and Microsoft Clarity's scripts and endpoints (src/lib/clarity.ts).
 * Outside images stay blocked, which also stops the Bing pixel Clarity's tag
 * adds. Every other fetch/XHR/WebSocket, and every outside image,
 * is blocked. This limits where data can go, not what is sent there.
 * 'wasm-unsafe-eval' lets the code beautifier compile its bundled WebAssembly
 * formatters; it allows no other kind of eval and no network access.
 */
export const CSP_DIRECTIVES = [
  "default-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval' https://www.clarity.ms https://scripts.clarity.ms",
  "worker-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  // The web app manifest (public/site.webmanifest), which lists the icons
  "manifest-src 'self'",
  "font-src 'self'",
  // Umami's endpoint, and Clarity's, whose host differs per project (a.clarity.ms, h.clarity.ms ...)
  `connect-src ${UMAMI_HOST} https://*.clarity.ms`,
  "base-uri 'none'",
  "form-action 'none'",
];

export const CSP = CSP_DIRECTIVES.join('; ');
