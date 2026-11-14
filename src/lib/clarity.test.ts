import { describe, expect, it } from 'vitest';
import { isClarityUrl } from './clarity';

describe('Clarity request gate', () => {
  it('recognises Clarity hosts', () => {
    for (const url of ['https://www.clarity.ms/tag/abc123', 'https://scripts.clarity.ms/0.8.79-beta/clarity.js', 'https://h.clarity.ms/collect', 'https://a.clarity.ms/collect']) {
      expect(isClarityUrl(url), url).toBe(true);
    }
  });

  it('leaves every other request alone', () => {
    for (const url of ['https://toolspace.tech/', 'https://gateway.umami.is/api/send', 'https://example.org/?q=clarity.ms', 'https://clarity.ms.evil.example/', 'not a url']) {
      expect(isClarityUrl(url), url).toBe(false);
    }
  });
});
