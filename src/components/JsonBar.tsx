import React from 'react';
import { Braces, CircleAlert, CircleCheck } from 'lucide-react';
import type { JsonCheck } from '@/lib/json';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

function Status({ side, check }: { side: 'a' | 'b'; check: JsonCheck }) {
  if (check.status === 'empty') return <span className="text-faint">{side}: empty</span>;
  if (check.status === 'valid')
    return (
      <span className="inline-flex items-center gap-1.5 text-add">
        <CircleCheck className="size-3.5" aria-hidden="true" />
        {side}: valid JSON
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-del" title={check.message}>
      <CircleAlert className="size-3.5" aria-hidden="true" />
      {side}: {check.message}
      {check.line != null && ` at line ${check.line}, column ${check.column}`}
    </span>
  );
}

interface JsonBarProps {
  left: JsonCheck;
  right: JsonCheck;
  onFormat: () => void;
  sortArrays: boolean;
  onSortArraysChange: (value: boolean) => void;
}

/** JSON page only: validity of each side and one-click formatting. */
const JsonBar: React.FC<JsonBarProps> = ({ left, right, onFormat, sortArrays, onSortArraysChange }) => (
  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b px-4 py-2 font-mono text-[12.5px]" aria-label="JSON status">
    <Status side="a" check={left} />
    <Status side="b" check={right} />
    <label
      htmlFor="opt-sort-arrays"
      className="ml-auto flex items-center gap-2 font-sans"
      title="When on, Format also puts the items of every array in a fixed order, so the same items in a different order stop showing as changes. Duplicates are kept, so [1,1,2] and [1,2] still differ."
    >
      <Switch id="opt-sort-arrays" size="sm" checked={sortArrays} onCheckedChange={onSortArraysChange} />
      Ignore array order
    </label>
    <Button
      variant="outline"
      size="sm"
      className="font-sans"
      onClick={onFormat}
      disabled={left.status !== 'valid' && right.status !== 'valid'}
      title="Pretty-print both sides with 2-space indentation and keys sorted A–Z, so reordered keys and minified files don't show up as changes"
    >
      <Braces /> {sortArrays ? 'Format JSON, sort keys & arrays' : 'Format JSON & sort keys'}
    </Button>
  </div>
);

export default JsonBar;
