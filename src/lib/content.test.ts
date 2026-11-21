import { describe, expect, it } from 'vitest';
import { PAGES } from '@/site';
import { TOOL_CONTENT } from '@/tools/content';
import { markdownToHtml } from './markdown';
import { gradientCss } from './color';
import { jsonToYaml, pathString } from './jsonTools';
import { parseJson } from './jsonValue';
import { lorem } from './generate';
import { titleCase } from './textCase';
import { checkJson } from './json';
import { jsonToCsv, stringifyJson } from './jsonTools';
import { encodeText } from './base64';
import { urlEncode } from './urlCodec';
import { decodeJwt } from './jwt';
import { isoWithOffset, parseTime } from './timestamp';
import { computeDiff } from './diffProcessor';
import { generatePatch } from './patch';
import { DIFF_CONTENT } from '@/components/diffContent';

describe('page metadata', () => {
  it('keeps titles to 60 characters and descriptions to 155, in plain ASCII', () => {
    for (const p of PAGES) {
      expect(p.title.length, p.id).toBeLessThanOrEqual(60);
      expect(p.description.length, p.id).toBeLessThanOrEqual(155);
      expect(p.description, p.id).toMatch(/^[\x20-\x7e]+$/);
      expect(p.description, p.id).not.toContain('"');
    }
  });

  it('says "no sign-up" in the titles of the most searched tools', () => {
    for (const id of ['jwt-decoder', 'password-generator', 'word-counter', 'base64', 'json-formatter']) {
      expect(PAGES.find((p) => p.id === id)!.title, id).toMatch(/no sign-up/i);
    }
  });
});

describe('worked examples show the tools’ real output', () => {
  it('markdown preview', () => {
    const ex = TOOL_CONTENT['markdown-preview'].example!;
    expect(markdownToHtml(ex.input)).toBe(ex.output);
  });

  it('css gradient', () => {
    const ex = TOOL_CONTENT['css-gradient'].example!;
    expect(`background: ${gradientCss('linear', 90, [{ color: '#ff7e5f', at: 0 }, { color: '#feb47b', at: 100 }])};`).toBe(ex.output);
  });

  it('json to yaml', () => {
    const ex = TOOL_CONTENT['json-to-yaml'].example!;
    expect(jsonToYaml(parseJson(ex.input))).toBe(ex.output);
  });

  it('json viewer', () => {
    const ex = TOOL_CONTENT['json-viewer'].example!;
    expect([pathString(['users', 0, 'email']), pathString(['users', 1, 'first-name'])].join('\n')).toBe(ex.output);
  });

  it('lorem ipsum', () => {
    const ex = TOOL_CONTENT['lorem-ipsum'].example!;
    expect(lorem('words', 8, { classic: true }).join(' ')).toBe(ex.output);
  });

  it('title case', () => {
    const ex = TOOL_CONTENT['title-case'].example!;
    expect([titleCase(ex.input, 'chicago'), titleCase(ex.input, 'ap')].join('\n')).toBe(ex.output);
  });

  it('json formatter', () => {
    const ex = TOOL_CONTENT['json-formatter'].example!;
    expect(stringifyJson(parseJson(ex.input), 2, false)).toBe(ex.output);
  });

  it('json validator', () => {
    const ex = TOOL_CONTENT['json-validator'].example!;
    const check = checkJson(ex.input);
    expect(check.status).toBe('invalid');
    if (check.status === 'invalid') expect(`${check.message} at line ${check.line}, column ${check.column}`).toBe(ex.output);
    // The note: with that comma gone, the next error is the comma after the ]
    const next = checkJson(ex.input.replace('"editor",]', '"editor"]'));
    expect(next).toMatchObject({ status: 'invalid', message: 'Trailing comma before "}"', line: 4 });
  });

  it('json to csv', () => {
    const ex = TOOL_CONTENT['json-to-csv'].example!;
    expect(jsonToCsv(parseJson(ex.input), { escapeFormulas: true }).csv).toBe(ex.output);
  });

  it('base64, standard and URL-safe', () => {
    const ex = TOOL_CONTENT.base64.example!;
    expect(ex.input.split('\n').map((t) => encodeText(t)).join('\n')).toBe(ex.output);
    expect(ex.note).toContain(encodeText('<<???>>', true));
  });

  it('url encoder', () => {
    const ex = TOOL_CONTENT['url-encoder'].example!;
    expect([urlEncode(ex.input, 'component'), urlEncode(ex.input, 'form')].join('\n')).toBe(ex.output);
  });

  it('jwt decoder', () => {
    const ex = TOOL_CONTENT['jwt-decoder'].example!;
    const r = decodeJwt(ex.input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect([JSON.stringify(r.jwt.header, null, 2), JSON.stringify(r.jwt.payload, null, 2)].join('\n')).toBe(ex.output);
      expect(new Date((r.jwt.payload as { iat: number }).iat * 1000).toISOString()).toBe('2018-01-18T01:30:22.000Z');
    }
  });

  it('unix timestamp', () => {
    const ex = TOOL_CONTENT['unix-timestamp'].example!;
    const out = ex.input.split('\n').map((t) => {
      const r = parseTime(t);
      if (!r.ok) throw new Error(t);
      return isoWithOffset(r.ms, 0);
    });
    expect(out.join('\n')).toBe(ex.output);
    expect(new Date(1760700000).getUTCFullYear()).toBe(1970); // the "mixing units" mistake
  });

  it('diff checker', () => {
    const ex = DIFF_CONTENT.text.example!;
    const [a, b] = ex.input.split('\n\n').map((side) => side.split('\n').slice(1).join('\n') + '\n');
    const r = computeDiff(a, b, { ignoreWhitespace: false, ignoreCase: false, charLevel: false, ignorePatterns: [] });
    expect(generatePatch(r.lines, r.eof, 'config.old.yml', 'config.yml')).toBe(ex.output);
  });

  it('the most visited pages have an example and common mistakes', () => {
    for (const id of ['json-formatter', 'json-validator', 'json-to-csv', 'base64', 'unix-timestamp', 'jwt-decoder', 'url-encoder'] as const) {
      expect(TOOL_CONTENT[id].example, id).toBeTruthy();
      expect(TOOL_CONTENT[id].mistakes!.length, id).toBeGreaterThanOrEqual(4);
    }
    for (const c of Object.values(DIFF_CONTENT)) expect(c.mistakes.length).toBeGreaterThanOrEqual(4);
  });

  it('the six shortest pages all have an example and common mistakes', () => {
    for (const id of ['markdown-preview', 'css-gradient', 'json-viewer', 'lorem-ipsum', 'json-to-yaml', 'title-case'] as const) {
      expect(TOOL_CONTENT[id].example, id).toBeTruthy();
      expect(TOOL_CONTENT[id].mistakes!.length, id).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('sources', () => {
  const all = [...Object.entries(TOOL_CONTENT), ...Object.entries(DIFF_CONTENT)].map(([id, c]) => [id, c.sources ?? []] as const);

  it('are https links with a title and what they back up, listed once per page', () => {
    for (const [id, sources] of all) {
      expect(new Set(sources.map((s) => s.url)).size, id).toBe(sources.length);
      for (const s of sources) {
        expect(new URL(s.url).protocol, `${id}: ${s.url}`).toBe('https:');
        expect(s.title.length, id).toBeGreaterThan(3);
        expect(s.about.length, id).toBeGreaterThan(10);
      }
    }
  });

  it('every related link points at another page', () => {
    for (const [id, c] of [...Object.entries(TOOL_CONTENT), ...Object.entries(DIFF_CONTENT)]) {
      for (const r of c.related ?? []) expect(PAGES.some((p) => p.id === r), `${id} → ${r}`).toBe(true);
    }
  });
});
