/*
 * Telemetry allowlist for Umami (public/umami.js). Loaded before the tracker:
 * its <script> tag names window.toolspaceUmamiBeforeSend in data-before-send
 * (documented since tracker v2.18.0), so Umami calls it with (type, payload)
 * before every send and sends only what it returns; a falsy value cancels.
 *
 * Every payload is rebuilt from fixed fields, so nothing typed, pasted, opened
 * or produced on the page can be included:
 *   url       the page's canonical path from the build (<link rel="canonical">),
 *             never the address bar, so no #fragment (share links) or ?query
 *   title     the page's static title from the build (og:title)
 *   referrer  only another site's origin ("https://example.com/"); none for
 *             links within toolspace, and never a path, query or fragment
 *   hostname, screen ("1440x900"), language ("en-US"), website (the site ID)
 *   name/data only the "tool-run" event, with { tool: <this page's ID> }
 * Every other send type (identify, performance, error) is cancelled.
 */
(function () {
  var TOOL_RUN = 'tool-run';

  function staticPath() {
    var link = document.querySelector('link[rel="canonical"]');
    try {
      return link ? new URL(link.href).pathname : null;
    } catch (e) {
      return null;
    }
  }

  function staticTitle() {
    var meta = document.querySelector('meta[property="og:title"]');
    return meta ? meta.content : null;
  }

  function pageId() {
    var root = document.getElementById('root');
    var id = root ? root.getAttribute('data-page') : null;
    return id && /^[a-z0-9-]{1,40}$/.test(id) ? id : null;
  }

  function referrerOrigin(ref) {
    // Umami strips this site's origin, leaving a path: an internal link, so no referrer
    if (typeof ref !== 'string' || ref.charAt(0) === '/' || !ref) return '';
    try {
      var u = new URL(ref);
      if (u.hostname === location.hostname || (u.protocol !== 'https:' && u.protocol !== 'http:')) return '';
      return u.origin + '/';
    } catch (e) {
      return '';
    }
  }

  window.toolspaceUmamiBeforeSend = function (type, payload) {
    if (type !== 'event' || !payload || typeof payload !== 'object') return null;
    var tracker = document.querySelector('script[src="/umami.js"]');
    var url = staticPath();
    var title = staticTitle();
    if (!tracker || !url || !title || payload.website !== tracker.getAttribute('data-website-id')) return null;

    var out = {
      website: payload.website,
      hostname: location.hostname,
      url: url,
      title: title,
      referrer: referrerOrigin(payload.referrer),
      screen: /^\d{1,5}x\d{1,5}$/.test(payload.screen) ? payload.screen : '',
      language: /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8}){0,3}$/.test(payload.language) ? payload.language : '',
    };

    // A pageview: no name, no data
    if (payload.name === undefined) return payload.data === undefined ? out : null;

    var tool = pageId();
    var data = payload.data;
    if (payload.name !== TOOL_RUN || !tool || !data || typeof data !== 'object') return null;
    var keys = Object.keys(data);
    if (keys.length !== 1 || keys[0] !== 'tool' || data.tool !== tool) return null;
    out.name = TOOL_RUN;
    out.data = { tool: tool };
    return out;
  };
})();
