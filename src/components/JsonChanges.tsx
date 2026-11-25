import React, { useDeferredValue, useMemo } from 'react';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { compareJson, type JsonChange } from '@/lib/jsonChanges';
import { Button } from '@/components/ui/button';

interface Props {
  originalText: string;
  changedText: string;
  ignoreArrayOrder: boolean;
}

const MARK: Record<JsonChange['kind'], string> = { added: '+', removed: '-', changed: '~' };
const TONE: Record<JsonChange['kind'], string> = { added: 'text-add', removed: 'text-del', changed: 'text-foreground' };

function describe(c: JsonChange): string {
  if (c.kind === 'added') return `+ ${c.path}: ${c.after}`;
  if (c.kind === 'removed') return `- ${c.path}: ${c.before}`;
  return `~ ${c.path}: ${c.before} -> ${c.after}${c.typeChange ? ` (${c.typeChange})` : ''}`;
}

function parse(text: string): { ok: true; value: unknown } | { ok: false } {
  if (!text.trim()) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

/** A long run of digits outside what a JavaScript number keeps exactly. */
const BIG_INT = /(^|[^\w.])-?\d{16,}(?![\w.])/;

/**
 * JSON page only: the changes between the two sides as a list of paths,
 * computed from the parsed JSON. It never edits either editor.
 */
const JsonChanges: React.FC<Props> = (props) => {
  // Typing in a big file stays responsive: the list catches up after the editor
  const originalText = useDeferredValue(props.originalText);
  const changedText = useDeferredValue(props.changedText);
  const ignoreArrayOrder = props.ignoreArrayOrder;
  const result = useMemo(() => {
    const a = parse(originalText);
    const b = parse(changedText);
    if (!a.ok || !b.ok) return null;
    return compareJson(a.value, b.value, { ignoreArrayOrder, limit: 500 });
  }, [originalText, changedText, ignoreArrayOrder]);

  if (!result) return null;
  const bigNumbers = BIG_INT.test(originalText) || BIG_INT.test(changedText);
  const copy = async () => {
    const text = result.changes.map(describe).join('\n') + (result.truncated ? `\n(first ${result.changes.length} of ${result.total} changes)` : '');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied the list of changes');
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <details className="group border-b" aria-label="Changes by path">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 font-sans text-[13px] hover:bg-muted/40">
        <span className="font-medium">Changes by path</span>
        <span className="text-muted-foreground">
          {result.total === 0 ? 'no differences in the JSON values' : `${result.total} ${result.total === 1 ? 'change' : 'changes'}`}
        </span>
        <span className="ml-auto text-faint group-open:hidden">show</span>
        <span className="ml-auto hidden text-faint group-open:inline">hide</span>
      </summary>
      <div className="space-y-2 px-4 pb-3 text-[12.5px]">
        <p className="text-muted-foreground">
          {ignoreArrayOrder
            ? 'Arrays are compared as unordered lists, and duplicates count. Array items show as [*] because their position is ignored. The line diff below only changes after you click Format.'
            : 'Arrays are compared by position, like the line diff. Object keys are matched by name, so key order never shows up.'}
        </p>
        {bigNumbers && (
          <p className="text-muted-foreground">
            A number with 16 or more digits is in the input. This list compares numbers as JavaScript does, so two long integers that differ only in the last digits may look equal here.
          </p>
        )}
        {result.total > 0 && (
          <>
            <ul className="max-h-64 overflow-auto rounded-md border bg-card font-mono" data-testid="json-changes">
              {result.changes.map((c, i) => (
                <li key={i} className="flex gap-2 border-b px-2 py-1 last:border-b-0">
                  <span className={`${TONE[c.kind]} w-3 shrink-0`} aria-hidden="true">{MARK[c.kind]}</span>
                  <span className="min-w-0 break-all">
                    <span className="font-semibold">{c.path}</span>{' '}
                    <span className="text-muted-foreground">
                      {c.kind === 'added' && <>added: {c.after}</>}
                      {c.kind === 'removed' && <>removed: {c.before}</>}
                      {c.kind === 'changed' && (
                        <>
                          {c.before} to {c.after}
                          {c.typeChange && <> ({c.typeChange})</>}
                        </>
                      )}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {result.truncated && (
              <p className="text-muted-foreground">
                Showing the first {result.changes.length} of {result.total} changes. Copy copies only these.
              </p>
            )}
            <Button variant="outline" size="sm" onClick={copy} className="font-sans">
              <Copy /> Copy list
            </Button>
          </>
        )}
      </div>
    </details>
  );
};

export default JsonChanges;
