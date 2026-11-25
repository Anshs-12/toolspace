/** Structural JSON comparison for the JSON diff page: a list of changed paths. */

export type JsonChangeKind = 'added' | 'removed' | 'changed';

export interface JsonChange {
  kind: JsonChangeKind;
  /** e.g. $.items[1].name */
  path: string;
  /** JSON text of the old value (removed, changed) */
  before?: string;
  /** JSON text of the new value (added, changed) */
  after?: string;
  /** For changed: the type changed, e.g. number -> string */
  typeChange?: string;
}

export interface JsonChangeResult {
  changes: JsonChange[];
  /** True when the list was cut at the limit */
  truncated: boolean;
  total: number;
}

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function child(path: string, key: string): string {
  return IDENT.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
}

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

/** Text of a value for display: compact JSON, cut when long. */
function show(v: unknown): string {
  const s = JSON.stringify(v);
  return s.length > 120 ? s.slice(0, 117) + '...' : s;
}

/** Key-sorted compact JSON, so equal values give equal text whatever their key order. */
function canon(v: unknown, sortArrays: boolean): string {
  if (Array.isArray(v)) {
    const items = v.map((x) => canon(x, sortArrays));
    if (sortArrays) items.sort();
    return '[' + items.join(',') + ']';
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + canon(o[k], sortArrays)).join(',') + '}';
  }
  return JSON.stringify(v);
}

/**
 * Compare two parsed JSON values and list what changed, by path.
 * Objects are matched by key (key order never matters). Arrays are matched by
 * position, or, with ignoreArrayOrder, as multisets: every item is counted, so
 * [1,1,2] against [1,2] reports one removed 1.
 */
export function compareJson(a: unknown, b: unknown, opts: { ignoreArrayOrder?: boolean; limit?: number } = {}): JsonChangeResult {
  const sortArrays = !!opts.ignoreArrayOrder;
  const limit = opts.limit ?? 500;
  const changes: JsonChange[] = [];
  let total = 0;
  const push = (c: JsonChange) => {
    total++;
    if (changes.length < limit) changes.push(c);
  };

  const walk = (x: unknown, y: unknown, path: string): void => {
    const tx = typeOf(x);
    const ty = typeOf(y);
    if (tx !== ty) {
      push({ kind: 'changed', path, before: show(x), after: show(y), typeChange: `${tx} -> ${ty}` });
      return;
    }
    if (tx === 'object') {
      const ox = x as Record<string, unknown>;
      const oy = y as Record<string, unknown>;
      const keys = [...new Set([...Object.keys(ox), ...Object.keys(oy)])].sort();
      for (const k of keys) {
        const p = child(path, k);
        const inX = Object.prototype.hasOwnProperty.call(ox, k);
        const inY = Object.prototype.hasOwnProperty.call(oy, k);
        if (inX && inY) walk(ox[k], oy[k], p);
        else if (inX) push({ kind: 'removed', path: p, before: show(ox[k]) });
        else push({ kind: 'added', path: p, after: show(oy[k]) });
      }
      return;
    }
    if (tx === 'array') {
      const ax = x as unknown[];
      const ay = y as unknown[];
      if (!sortArrays) {
        const n = Math.max(ax.length, ay.length);
        for (let i = 0; i < n; i++) {
          const p = `${path}[${i}]`;
          if (i < ax.length && i < ay.length) walk(ax[i], ay[i], p);
          else if (i < ax.length) push({ kind: 'removed', path: p, before: show(ax[i]) });
          else push({ kind: 'added', path: p, after: show(ay[i]) });
        }
        return;
      }
      // Multiset: cancel equal items, report what is left on each side
      const left = new Map<string, unknown[]>();
      for (const item of ax) {
        const key = canon(item, true);
        (left.get(key) ?? left.set(key, []).get(key)!).push(item);
      }
      const extraRight: unknown[] = [];
      for (const item of ay) {
        const bucket = left.get(canon(item, true));
        if (bucket && bucket.length) bucket.pop();
        else extraRight.push(item);
      }
      const extraLeft: unknown[] = [];
      for (const bucket of left.values()) extraLeft.push(...bucket);
      // Report in a stable order
      extraLeft.sort((p, q) => (canon(p, true) < canon(q, true) ? -1 : 1));
      extraRight.sort((p, q) => (canon(p, true) < canon(q, true) ? -1 : 1));
      for (const item of extraLeft) push({ kind: 'removed', path: `${path}[*]`, before: show(item) });
      for (const item of extraRight) push({ kind: 'added', path: `${path}[*]`, after: show(item) });
      return;
    }
    if (!Object.is(x, y)) push({ kind: 'changed', path, before: show(x), after: show(y) });
  };

  walk(a, b, '$');
  return { changes, truncated: total > changes.length, total };
}
