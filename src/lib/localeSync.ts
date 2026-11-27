/**
 * Locale file sync: check several JSON locale files against a base language,
 * then build fixed copies. Checking and fixing run entirely in the browser.
 *
 * Safety rules the UI relies on:
 * - Fills never invent translations: a missing key is filled with an empty
 *   string, or with a copy of the base value when the user asks for that.
 *   Base-filled values still count as "untranslated" in the re-check.
 * - Extra keys and duplicate keys are never removed silently: extras are
 *   removed only when their exact flattened key is in the approved list, and
 *   duplicate keys are reported but never merged by the fixer.
 */

import { checkJson } from './json';
import { scanJson } from './jsonValue';

export type LeafValue = string | number | boolean | null | unknown[];

export interface LocaleFileInput {
  name: string;
  text: string;
}

export interface DuplicateKey {
  key: string;
  line: number;
  column: number;
}

export interface LoadedLocale {
  /** File name as given, e.g. "en.json". */
  name: string;
  /** Language label: the file name without its .json extension. */
  lang: string;
  /** Flattened leaf values by dot path ("nav.home"). */
  keys: Record<string, LeafValue>;
  /** Flattened keys in document order. */
  order: string[];
  /** The parsed object, or null when the file is not valid JSON or not an object. */
  value: Record<string, unknown> | null;
  error: string | null;
  duplicateCount: number;
  duplicates: DuplicateKey[];
}

/** "en.json" -> "en"; a name without .json is used as-is. */
export function langOf(name: string): string {
  return name.replace(/\.json$/i, '');
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/** Join a dot path and a key; keys that contain dots are quoted ("a.\"b.c\""). */
export function joinPath(prefix: string, key: string): string {
  const part = key.includes('.') || key.includes('"') ? JSON.stringify(key) : key;
  return prefix ? `${prefix}.${part}` : part;
}

/** Split a dot path back into segments (inverse of joinPath). */
export function splitPath(path: string): string[] {
  const out: string[] = [];
  let i = 0;
  let cur = '';
  while (i < path.length) {
    const c = path[i];
    if (c === '"') {
      const end = path.indexOf('"', i + 1);
      if (end === -1) return [...out, cur + path.slice(i)];
      if (cur) out.push(cur);
      out.push(path.slice(i + 1, end));
      cur = '';
      i = end + 2; // skip closing quote and the dot after it
    } else if (c === '.') {
      out.push(cur);
      cur = '';
      i++;
    } else {
      cur += c;
      i++;
    }
  }
  if (cur || path.endsWith('.')) out.push(cur);
  return out;
}

/** Flatten a locale object into dot paths. Arrays and scalars are leaves. */
export function flattenLocale(value: Record<string, unknown>): { keys: Record<string, LeafValue>; order: string[] } {
  const keys: Record<string, LeafValue> = {};
  const order: string[] = [];
  const walk = (obj: Record<string, unknown>, prefix: string) => {
    for (const key of Object.keys(obj)) {
      const v = obj[key];
      const path = joinPath(prefix, key);
      if (isPlainObject(v)) {
        if (Object.keys(v).length === 0) {
          keys[path] = '';
          order.push(path);
        } else {
          walk(v, path);
        }
      } else {
        keys[path] = v as LeafValue;
        order.push(path);
      }
    }
  };
  walk(value, '');
  return { keys, order };
}

/**
 * Placeholder tokens in a string: i18next-style {{name}} (including formats
 * like {{count, number}}) and ICU-style {name}. Compared as sorted sets.
 */
export function placeholders(text: string): string[] {
  const found = new Set<string>();
  const rest = text.replace(/\{\{[^{}]+\}\}/g, (m) => {
    found.add(m.replace(/\s+/g, ' '));
    return '';
  });
  for (const m of rest.matchAll(/\{[a-zA-Z_][^{}]*\}/g)) found.add(m[0].replace(/\s+/g, ' '));
  return [...found].sort();
}

/** Load and parse one file. Invalid JSON or a non-object root yields error, not a throw. */
export function loadLocale(input: LocaleFileInput): LoadedLocale {
  const base: LoadedLocale = {
    name: input.name,
    lang: langOf(input.name),
    keys: {},
    order: [],
    value: null,
    error: null,
    duplicateCount: 0,
    duplicates: [],
  };
  const check = checkJson(input.text);
  if (check.status === 'empty') return { ...base, error: 'The file is empty.' };
  if (check.status === 'invalid') {
    const where = check.line != null ? ` (line ${check.line}, column ${check.column})` : '';
    return { ...base, error: `${check.message}${where}` };
  }
  let value: unknown;
  try {
    value = JSON.parse(input.text);
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : 'Could not parse this file.' };
  }
  if (!isPlainObject(value)) return { ...base, error: 'The top level must be a JSON object ({ ... }).' };
  const { keys, order } = flattenLocale(value);
  const scan = scanJson(input.text);
  return {
    ...base,
    value,
    keys,
    order,
    duplicateCount: scan.duplicateCount,
    duplicates: scan.duplicates,
  };
}

export type IssueKind = 'missing' | 'extra' | 'empty' | 'untranslated' | 'placeholder' | 'type';

export interface LocaleIssue {
  lang: string;
  key: string;
  kind: IssueKind;
  detail: string;
}

export interface LangSummary {
  total: number;
  missing: number;
  extra: number;
  empty: number;
  untranslated: number;
  placeholder: number;
  type: number;
}

export interface LocaleReport {
  base: string;
  baseKeys: number;
  issues: LocaleIssue[];
  summary: Record<string, LangSummary>;
}

const leafType = (v: LeafValue): string =>
  v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;

const sameLeaf = (a: LeafValue, b: LeafValue): boolean =>
  Array.isArray(a) || Array.isArray(b) ? JSON.stringify(a) === JSON.stringify(b) : a === b;

/** Compare every file against the base language. The base itself is not summarized. */
export function analyzeLocales(files: LoadedLocale[], baseLang: string): LocaleReport | { error: string } {
  const base = files.find((f) => f.lang === baseLang);
  if (!base || !base.value) return { error: `Base language "${baseLang}" has no parsed file.` };
  const issues: LocaleIssue[] = [];
  const summary: Record<string, LangSummary> = {};
  for (const file of files) {
    if (file.lang === baseLang || !file.value) continue;
    const s: LangSummary = { total: file.order.length, missing: 0, extra: 0, empty: 0, untranslated: 0, placeholder: 0, type: 0 };
    const push = (key: string, kind: IssueKind, detail: string) => {
      issues.push({ lang: file.lang, key, kind, detail });
      s[kind === 'placeholder' ? 'placeholder' : kind]++;
    };
    for (const key of base.order) {
      const bv = base.keys[key];
      if (!(key in file.keys)) {
        push(key, 'missing', `in ${baseLang} but not in ${file.lang}`);
        continue;
      }
      const fv = file.keys[key];
      if (leafType(bv) !== leafType(fv)) {
        push(key, 'type', `${leafType(bv)} in ${baseLang}, ${leafType(fv)} in ${file.lang}`);
        continue;
      }
      if (typeof bv === 'string' && typeof fv === 'string') {
        const bp = placeholders(bv);
        const fp = placeholders(fv);
        if (bp.join('|') !== fp.join('|')) {
          push(key, 'placeholder', `${baseLang} has ${bp.join(' ') || 'no placeholders'}, ${file.lang} has ${fp.join(' ') || 'none'}`);
        }
      }
      if (typeof fv === 'string' && fv.trim() === '') push(key, 'empty', 'empty string');
      if (typeof bv === 'string' && typeof fv === 'string' && fv.trim() !== '' && sameLeaf(bv, fv))
        push(key, 'untranslated', `same as ${baseLang}: ${JSON.stringify(bv.length > 40 ? bv.slice(0, 40) + '…' : bv)}`);
    }
    for (const key of file.order) {
      if (!(key in base.keys)) push(key, 'extra', `in ${file.lang} but not in ${baseLang}`);
    }
    summary[file.lang] = s;
  }
  return { base: baseLang, baseKeys: base.order.length, issues, summary };
}

export interface FixOptions {
  /** Fill missing keys with an empty string, or with a copy of the base value. */
  fillMissing: 'empty' | 'base';
  /** Reorder keys to match the base file's order (extras keep their relative order at the end). */
  sortToBase: boolean;
  /** Flattened extra keys the user explicitly approved for removal. */
  removeExtras: string[];
}

export interface FixResult {
  text: string;
  /** Keys filled in; still untranslated when fillMissing is "base", still empty when "empty". */
  filled: string[];
  /** Missing keys that could not be filled because a non-object sits in their path. */
  blocked: string[];
  /** Extra keys actually removed (only approved ones). */
  removed: string[];
}

function setLeaf(target: Record<string, unknown>, path: string, value: LeafValue): boolean {
  const segs = splitPath(path);
  let node: Record<string, unknown> = target;
  for (let i = 0; i < segs.length - 1; i++) {
    const next = node[segs[i]];
    if (isPlainObject(next)) {
      node = next;
    } else if (next === undefined) {
      const created: Record<string, unknown> = {};
      node[segs[i]] = created;
      node = created;
    } else {
      return false; // a scalar or array blocks this path
    }
  }
  node[segs[segs.length - 1]] = value;
  return true;
}

function deleteLeaf(target: Record<string, unknown>, path: string): void {
  const segs = splitPath(path);
  const chain: Record<string, unknown>[] = [];
  let node: Record<string, unknown> = target;
  for (let i = 0; i < segs.length - 1; i++) {
    const next = node[segs[i]];
    if (!isPlainObject(next)) return;
    chain.push(node);
    node = next;
  }
  delete node[segs[segs.length - 1]];
  // Remove parents that became empty, so no "{}" shells remain.
  for (let i = chain.length - 1; i >= 0; i--) {
    const child = chain[i][segs[i]];
    if (isPlainObject(child) && Object.keys(child).length === 0) delete chain[i][segs[i]];
  }
}

const deepClone = (v: LeafValue): LeafValue => (Array.isArray(v) ? (JSON.parse(JSON.stringify(v)) as unknown[]) : v);

/** Reorder keys of `value` to follow `baseOrder`, then any leftover keys in their original order. */
function orderLike(value: Record<string, unknown>, baseValue: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(baseValue)) {
    if (!(key in value)) continue;
    const v = value[key];
    const bv = baseValue[key];
    out[key] = isPlainObject(v) && isPlainObject(bv) ? orderLike(v, bv) : v;
  }
  for (const key of Object.keys(value)) {
    if (!(key in out)) {
      const v = value[key];
      out[key] = isPlainObject(v) ? orderLike(v, {}) : v;
    }
  }
  return out;
}

/**
 * Build a fixed copy of one file. Starts from the file's own parsed object:
 * approved extras are deleted, missing keys are filled, and keys are
 * optionally reordered to the base. Nothing else changes, so existing
 * translations and formatting values survive byte-for-byte.
 */
export function fixLocale(file: LoadedLocale, base: LoadedLocale, opts: FixOptions): FixResult {
  const result: FixResult = { text: '', filled: [], blocked: [], removed: [] };
  if (!file.value || !base.value) return result;
  const value: Record<string, unknown> = JSON.parse(JSON.stringify(file.value)) as Record<string, unknown>;

  const approved = new Set(opts.removeExtras);
  for (const key of file.order) {
    if (!(key in base.keys) && approved.has(key)) {
      deleteLeaf(value, key);
      result.removed.push(key);
    }
  }
  for (const key of base.order) {
    if (key in file.keys) continue;
    const fill = opts.fillMissing === 'base' ? deepClone(base.keys[key]) : '';
    if (setLeaf(value, key, fill)) result.filled.push(key);
    else result.blocked.push(key);
  }
  const finalValue = opts.sortToBase ? orderLike(value, base.value) : value;
  result.text = JSON.stringify(finalValue, null, 2) + '\n';
  return result;
}
