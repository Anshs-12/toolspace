import { describe, expect, it } from 'vitest';
import { isGoogleUrl } from './gaGuard';

describe('consent switch on Google requests', () => {
  it('recognises Google analytics and ads hosts', () => {
    for (const url of [
      'https://www.google-analytics.com/g/collect?v=2',
      'https://region1.google-analytics.com/g/collect',
      'https://analytics.google.com/g/collect',
      'https://stats.g.doubleclick.net/g/collect',
      'https://www.googletagmanager.com/gtag/js?id=G-F1P7CTRGH3',
      'https://www.google.com/ccm/geo',
      'https://www.merchant-center-analytics.goog/mc/collect',
    ]) {
      expect(isGoogleUrl(url), url).toBe(true);
    }
  });

  it('leaves every other request alone', () => {
    for (const url of ['https://toolspace.tech/', '/sw.js', 'https://example.org/?q=google.com', 'https://notgoogle-analytics.com.evil.example/', 'not a url']) {
      expect(isGoogleUrl(url), url).toBe(false);
    }
  });
});
