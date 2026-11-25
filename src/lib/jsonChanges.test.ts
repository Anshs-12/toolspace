import { describe, expect, it } from 'vitest';
import { compareJson } from './jsonChanges';

const c = (a: unknown, b: unknown, ignoreArrayOrder = false) => compareJson(a, b, { ignoreArrayOrder }).changes;

describe('compareJson', () => {
  it('reports nothing for equal values, whatever the key order', () => {
    expect(c({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toEqual([]);
  });
  it('reports changed, added and removed keys with their paths', () => {
    expect(c({ a: 1, b: 2, d: { x: 1 } }, { a: 2, c: 3, d: { x: 1 } })).toEqual([
      { kind: 'changed', path: '$.a', before: '1', after: '2' },
      { kind: 'removed', path: '$.b', before: '2' },
      { kind: 'added', path: '$.c', after: '3' },
    ]);
  });
  it('quotes keys that are not plain identifiers', () => {
    expect(c({ 'a-b': 1 }, { 'a-b': 2 })[0]!.path).toBe('$["a-b"]');
  });
  it('flags a type change, and keeps 1 and "1" apart', () => {
    expect(c({ a: 1 }, { a: '1' })).toEqual([{ kind: 'changed', path: '$.a', before: '1', after: '"1"', typeChange: 'number -> string' }]);
    expect(c({ a: null }, { a: 'null' })[0]!.typeChange).toBe('null -> string');
    expect(c({ a: [] }, { a: {} })[0]!.typeChange).toBe('array -> object');
  });
  it('compares arrays by position by default', () => {
    expect(c([1, 2], [2, 1]).map((x) => x.path)).toEqual(['$[0]', '$[1]']);
    expect(c([1, 2], [1, 2, 3])).toEqual([{ kind: 'added', path: '$[2]', after: '3' }]);
  });
  describe('ignore array order', () => {
    it('treats a reordered array as equal, at any depth', () => {
      expect(c({ t: [3, 1, 2] }, { t: [2, 3, 1] }, true)).toEqual([]);
      expect(c({ a: [[1, 2], [3]] }, { a: [[3], [2, 1]] }, true)).toEqual([]);
      expect(c([{ id: 1, n: 'a' }, { id: 2 }], [{ id: 2 }, { n: 'a', id: 1 }], true)).toEqual([]);
    });
    it('counts duplicates', () => {
      expect(c([1, 1, 2], [1, 2], true)).toEqual([{ kind: 'removed', path: '$[*]', before: '1' }]);
      expect(c([1, 2], [2, 1, 1], true)).toEqual([{ kind: 'added', path: '$[*]', after: '1' }]);
    });
    it('keeps types apart and reports the items that differ', () => {
      expect(c([1], ['1'], true)).toEqual([
        { kind: 'removed', path: '$[*]', before: '1' },
        { kind: 'added', path: '$[*]', after: '"1"' },
      ]);
    });
    it('is off by default', () => {
      expect(c([1, 2], [2, 1])).not.toEqual([]);
    });
  });
  it('cuts the list at the limit and says so', () => {
    const a = Array.from({ length: 10 }, (_, i) => i);
    const r = compareJson(a, a.map((x) => x + 1), { limit: 3 });
    expect(r.changes).toHaveLength(3);
    expect(r.total).toBe(10);
    expect(r.truncated).toBe(true);
  });
});

describe('compareJson edge cases', () => {
  it('handles __proto__, constructor and empty keys as plain keys', () => {
    const a = JSON.parse('{"__proto__":{"x":1},"constructor":1,"":2}');
    const b = JSON.parse('{"__proto__":{"x":2},"constructor":1,"":3}');
    const r = c(a, b);
    expect(r.map((x) => x.path).sort()).toEqual(['$.__proto__.x', '$[""]']);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });
  it('escapes dots and quotes in keys', () => {
    expect(c({ 'a.b': 1 }, { 'a.b': 2 })[0]!.path).toBe('$["a.b"]');
    expect(c({ 'a"b': 1 }, { 'a"b': 2 })[0]!.path).toBe('$["a\\"b"]');
  });
  it('does not change its inputs', () => {
    const a = { t: [3, 1, 2] };
    const b = { t: [2, 3, 1] };
    c(a, b, true);
    expect(a).toEqual({ t: [3, 1, 2] });
    expect(b).toEqual({ t: [2, 3, 1] });
  });
  it('compares top-level scalars and null', () => {
    expect(c(1, 2)).toEqual([{ kind: 'changed', path: '$', before: '1', after: '2' }]);
    expect(c(null, null)).toEqual([]);
  });
});
