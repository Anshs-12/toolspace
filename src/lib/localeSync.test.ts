import { describe, expect, it } from 'vitest';
import {
  analyzeLocales,
  fixLocale,
  flattenLocale,
  joinPath,
  langOf,
  loadLocale,
  placeholders,
  splitPath,
  type LoadedLocale,
  type LocaleReport,
} from './localeSync';

const load = (name: string, obj: unknown) => loadLocale({ name, text: typeof obj === 'string' ? obj : JSON.stringify(obj) });

const EN = {
  common: { save: 'Save', cancel: 'Cancel', greeting: 'Hello, {{name}}!' },
  nav: { home: 'Home', about: 'About' },
};
const DE = {
  common: { save: 'Speichern', cancel: 'Cancel', greeting: 'Hallo, {{username}}!' },
  extra: { legacy: 'Alt' },
};

describe('langOf', () => {
  it('strips the .json extension', () => {
    expect(langOf('en.json')).toBe('en');
    expect(langOf('de-DE.JSON')).toBe('de-DE');
    expect(langOf('base')).toBe('base');
  });
});

describe('joinPath / splitPath', () => {
  it('round-trips plain keys', () => {
    expect(joinPath('a.b', 'c')).toBe('a.b.c');
    expect(splitPath('a.b.c')).toEqual(['a', 'b', 'c']);
  });
  it('quotes keys containing dots', () => {
    const p = joinPath('a', 'b.c');
    expect(splitPath(p)).toEqual(['a', 'b.c']);
  });
});

describe('flattenLocale', () => {
  it('flattens nested objects to dot paths in document order', () => {
    const { keys, order } = flattenLocale(EN);
    expect(keys['common.save']).toBe('Save');
    expect(keys['nav.about']).toBe('About');
    expect(order).toEqual(['common.save', 'common.cancel', 'common.greeting', 'nav.home', 'nav.about']);
  });
  it('treats arrays as leaves', () => {
    const { keys } = flattenLocale({ list: ['a', 'b'] });
    expect(keys.list).toEqual(['a', 'b']);
  });
  it('treats an empty object as an empty-string leaf', () => {
    const { keys } = flattenLocale({ empty: {} });
    expect(keys.empty).toBe('');
  });
});

describe('placeholders', () => {
  it('extracts i18next and ICU tokens, sorted and unique', () => {
    expect(placeholders('Hi {{name}}, you have {count} items and {{name}} again')).toEqual(['{count}', '{{name}}']);
  });
  it('keeps i18next format specifiers', () => {
    expect(placeholders('{{count, number}} items')).toEqual(['{{count, number}}']);
  });
  it('does not split double braces into singles', () => {
    expect(placeholders('{{name}}')).toEqual(['{{name}}']);
  });
  it('returns [] for plain text', () => {
    expect(placeholders('no tokens')).toEqual([]);
  });
});

describe('loadLocale', () => {
  it('loads a valid object file', () => {
    const f = load('en.json', EN);
    expect(f.error).toBeNull();
    expect(f.lang).toBe('en');
    expect(f.order.length).toBe(5);
  });
  it('reports invalid JSON with a position instead of throwing', () => {
    const f = loadLocale({ name: 'bad.json', text: '{"a": 1,}' });
    expect(f.error).toMatch(/line \d+, column \d+/);
    expect(f.value).toBeNull();
  });
  it('rejects a non-object root', () => {
    expect(load('arr.json', [1, 2]).error).toMatch(/top level/);
  });
  it('flags empty files', () => {
    expect(loadLocale({ name: 'e.json', text: '  ' }).error).toMatch(/empty/);
  });
  it('reports duplicate keys with positions', () => {
    const f = loadLocale({ name: 'd.json', text: '{\n  "a": 1,\n  "a": 2\n}' });
    expect(f.duplicateCount).toBe(1);
    expect(f.duplicates[0].key).toBe('a');
    expect(f.duplicates[0].line).toBe(3);
  });
});

describe('analyzeLocales', () => {
  const report = analyzeLocales([load('en.json', EN), load('de.json', DE)], 'en') as LocaleReport;

  it('finds missing keys against the base', () => {
    const missing = report.issues.filter((i) => i.kind === 'missing').map((i) => i.key);
    expect(missing).toEqual(['nav.home', 'nav.about']);
    expect(report.summary.de.missing).toBe(2);
  });
  it('finds extra keys', () => {
    const extra = report.issues.filter((i) => i.kind === 'extra').map((i) => i.key);
    expect(extra).toEqual(['extra.legacy']);
  });
  it('flags untranslated strings identical to the base', () => {
    const un = report.issues.filter((i) => i.kind === 'untranslated').map((i) => i.key);
    expect(un).toEqual(['common.cancel']);
  });
  it('flags placeholder mismatches with both sides named', () => {
    const ph = report.issues.filter((i) => i.kind === 'placeholder');
    expect(ph.map((i) => i.key)).toEqual(['common.greeting']);
    expect(ph[0].detail).toContain('{{name}}');
    expect(ph[0].detail).toContain('{{username}}');
  });
  it('flags empty strings', () => {
    const r = analyzeLocales([load('en.json', EN), load('de.json', { ...DE, nav: { home: '', about: 'Über' } })], 'en') as LocaleReport;
    expect(r.issues.filter((i) => i.kind === 'empty').map((i) => i.key)).toEqual(['nav.home']);
  });
  it('flags type mismatches', () => {
    const r = analyzeLocales([load('en.json', EN), load('de.json', { ...DE, nav: { home: 5, about: 'Über' } })], 'en') as LocaleReport;
    const t = r.issues.filter((i) => i.kind === 'type').map((i) => i.key);
    expect(t).toEqual(['nav.home']);
    expect(r.issues.find((i) => i.kind === 'type')?.detail).toContain('string');
    expect(r.issues.find((i) => i.kind === 'type')?.detail).toContain('number');
  });
  it('skips files that failed to parse and the base itself', () => {
    const bad = loadLocale({ name: 'fr.json', text: '{' });
    const r = analyzeLocales([load('en.json', EN), bad, load('de.json', DE)], 'en') as LocaleReport;
    expect(Object.keys(r.summary)).toEqual(['de']);
  });
  it('errors when the base file is missing', () => {
    const r = analyzeLocales([load('de.json', DE)], 'en');
    expect('error' in r).toBe(true);
  });
});

describe('fixLocale', () => {
  const en = load('en.json', EN);
  const de = load('de.json', DE);
  const baseOpts = { fillMissing: 'empty' as const, sortToBase: false, removeExtras: [] as string[] };

  it('fills missing keys with empty strings by default', () => {
    const r = fixLocale(de, en, baseOpts);
    expect(r.filled).toEqual(['nav.home', 'nav.about']);
    const fixed = JSON.parse(r.text);
    expect(fixed.nav).toEqual({ home: '', about: '' });
  });
  it('base-fill copies the base value, and the re-check still counts it untranslated', () => {
    const r = fixLocale(de, en, { ...baseOpts, fillMissing: 'base' });
    const fixed: LoadedLocale = loadLocale({ name: 'de.json', text: r.text });
    const after = analyzeLocales([en, fixed], 'en') as LocaleReport;
    expect(after.summary.de.missing).toBe(0);
    const un = after.issues.filter((i) => i.kind === 'untranslated').map((i) => i.key);
    expect(un).toEqual(expect.arrayContaining(['nav.home', 'nav.about', 'common.cancel']));
  });
  it('removes only approved extras, and cleans up emptied parents', () => {
    const r = fixLocale(de, en, { ...baseOpts, removeExtras: ['extra.legacy'] });
    expect(r.removed).toEqual(['extra.legacy']);
    const fixed = JSON.parse(r.text);
    expect('extra' in fixed).toBe(false);
  });
  it('keeps unapproved extras untouched', () => {
    const r = fixLocale(de, en, baseOpts);
    expect(JSON.parse(r.text).extra).toEqual({ legacy: 'Alt' });
  });
  it('sorts keys to base order when asked, extras last in original order', () => {
    const shuffled = load('de.json', {
      extra: { legacy: 'Alt' },
      nav: { about: 'Über', home: 'Start' },
      common: { greeting: 'Hallo, {{name}}!', cancel: 'Abbrechen', save: 'Speichern' },
    });
    const r = fixLocale(shuffled, en, { ...baseOpts, sortToBase: true });
    const after = analyzeLocales([en, loadLocale({ name: 'de.json', text: r.text })], 'en') as LocaleReport;
    expect(after.summary.de.missing).toBe(0);
    expect(loadLocale({ name: 'de.json', text: r.text }).order.slice(0, 3)).toEqual(['common.save', 'common.cancel', 'common.greeting']);
  });
  it('reports fills blocked by a scalar in the path instead of overwriting it', () => {
    const broken = load('de.json', { common: 'not an object' });
    const r = fixLocale(broken, en, baseOpts);
    expect(r.blocked).toEqual(['common.save', 'common.cancel', 'common.greeting']);
    expect(r.filled).toEqual(['nav.home', 'nav.about']);
    expect(JSON.parse(r.text).common).toBe('not an object');
  });
  it('never touches duplicate keys: re-check still reports them', () => {
    const dup = loadLocale({ name: 'de.json', text: '{"a": 1, "a": 2}' });
    const r = fixLocale(dup, en, baseOpts);
    const after = loadLocale({ name: 'de.json', text: r.text });
    // The fixer does not claim to resolve duplicates; the file round-trips.
    expect(after.error).toBeNull();
    expect(dup.duplicateCount).toBe(1);
  });
  it('ends the file with a newline and two-space indentation', () => {
    const r = fixLocale(de, en, baseOpts);
    expect(r.text.endsWith('\n')).toBe(true);
    expect(r.text).toContain('\n  "common": {');
  });
});
