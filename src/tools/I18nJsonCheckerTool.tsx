import { useMemo, useRef, useState } from 'react';
import { Download, FileJson, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  analyzeLocales,
  fixLocale,
  loadLocale,
  type FixResult,
  type IssueKind,
  type LoadedLocale,
} from '@/lib/localeSync';
import ToolBar from './ToolBar';
import OptionSwitch from './OptionSwitch';
import { copyText, downloadFile, readTextFile } from './shared';
import { useToolRun } from '@/lib/analytics';

const EXAMPLE_FILES = [
  {
    name: 'en.json',
    text: JSON.stringify(
      {
        common: { save: 'Save', cancel: 'Cancel', greeting: 'Hello, {{name}}!', items: '{count} items' },
        nav: { home: 'Home', about: 'About', settings: 'Settings' },
      },
      null,
      2,
    ),
  },
  {
    name: 'de.json',
    text: JSON.stringify(
      {
        common: { save: 'Speichern', cancel: 'Cancel', greeting: 'Hallo, {{username}}!' },
        nav: { home: 'Startseite', about: 'Über uns' },
        legacy: { oldKey: 'Nicht mehr benutzt' },
      },
      null,
      2,
    ),
  },
  {
    name: 'fr.json',
    text: JSON.stringify(
      {
        common: { save: 'Enregistrer', cancel: 'Annuler', greeting: 'Bonjour, {{name}} !', items: '' },
        nav: { home: 'Accueil', about: 'À propos', settings: 'Paramètres' },
      },
      null,
      2,
    ),
  },
];

const KIND_LABEL: Record<IssueKind, string> = {
  missing: 'missing',
  extra: 'extra',
  empty: 'empty',
  untranslated: 'untranslated?',
  placeholder: 'placeholder',
  type: 'type mismatch',
};

const KIND_CLASS: Record<IssueKind, string> = {
  missing: 'text-red-600 dark:text-red-400',
  placeholder: 'text-red-600 dark:text-red-400',
  type: 'text-red-600 dark:text-red-400',
  untranslated: 'text-amber-600 dark:text-amber-400',
  empty: 'text-amber-600 dark:text-amber-400',
  extra: 'text-muted-foreground',
};

export default function I18nJsonCheckerTool() {
  // Plain state on purpose: locale files are never saved or put in a link (PRIVATE_TOOLS).
  const [files, setFiles] = useState<LoadedLocale[]>([]);
  const [baseLang, setBaseLang] = useState<string>('');
  const [fillMissing, setFillMissing] = useState<'empty' | 'base'>('empty');
  const [sortToBase, setSortToBase] = useState(true);
  const [approvedExtras, setApprovedExtras] = useState<Set<string>>(new Set());
  const [fixes, setFixes] = useState<Record<string, FixResult> | null>(null);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const parsed = files.filter((f) => f.value);
  const base = baseLang || (parsed.length ? parsed.reduce((a, b) => (a.order.length >= b.order.length ? a : b)).lang : '');

  const report = useMemo(() => {
    if (parsed.length < 2 || !base) return null;
    const r = analyzeLocales(parsed, base);
    return 'error' in r ? null : r;
  }, [files, base]); // eslint-disable-line react-hooks/exhaustive-deps

  useToolRun(report ? `${report.issues.length}` : null);

  const addFiles = async (list: FileList | File[]) => {
    const loaded: LoadedLocale[] = [];
    for (const file of Array.from(list)) {
      const text = await readTextFile(file);
      if (text != null) loaded.push(loadLocale({ name: file.name, text }));
    }
    if (!loaded.length) return;
    setFiles((prev) => {
      const names = new Set(loaded.map((f) => f.name));
      return [...prev.filter((f) => !names.has(f.name)), ...loaded];
    });
    setFixes(null);
  };

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
    setFixes(null);
  };

  const extras = useMemo(() => (report ? report.issues.filter((i) => i.kind === 'extra') : []), [report]);
  const extraId = (lang: string, key: string) => `${lang}${key}`;

  const prepareFixes = () => {
    if (!report) return;
    const baseFile = parsed.find((f) => f.lang === report.base);
    if (!baseFile) return;
    const out: Record<string, FixResult> = {};
    for (const lang of Object.keys(report.summary)) {
      const file = parsed.find((f) => f.lang === lang);
      if (!file) continue;
      out[lang] = fixLocale(file, baseFile, {
        fillMissing,
        sortToBase,
        removeExtras: extras.filter((i) => i.lang === lang && approvedExtras.has(extraId(i.lang, i.key))).map((i) => i.key),
      });
    }
    setFixes(out);
  };

  const issueCount = report?.issues.length ?? 0;

  return (
    <>
      <ToolBar
        onExample={() => {
          setFiles(EXAMPLE_FILES.map((f) => loadLocale(f)));
          setBaseLang('en');
          setApprovedExtras(new Set());
          setFixes(null);
        }}
      >
        <OptionSwitch id="i18n-sort" label="Sort keys like the base file" checked={sortToBase} onChange={(v) => { setSortToBase(v); setFixes(null); }} />
        <select
          value={fillMissing}
          onChange={(e) => { setFillMissing(e.target.value as 'empty' | 'base'); setFixes(null); }}
          aria-label="Fill missing keys with"
          className="h-8 rounded-md border bg-background px-2 text-[13px]"
        >
          <option value="empty">Fill missing keys with empty strings</option>
          <option value="base">Copy the base text into missing keys</option>
        </select>
      </ToolBar>

      <div
        className={cn('border-b px-4 py-4', over && 'bg-accent/40')}
        onDragOver={(e) => {
          if (Array.from(e.dataTransfer.types).includes('Files')) {
            e.preventDefault();
            setOver(true);
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
        }}
        onDrop={async (e) => {
          e.preventDefault();
          setOver(false);
          await addFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          multiple
          className="hidden"
          onChange={async (e) => {
            if (e.target.files) await addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <Upload /> Add locale files
          </Button>
          <span className="text-[12.5px] text-muted-foreground">
            Drop your JSON locale files here (one per language, like en.json, de.json). They are read in this tab and never uploaded or saved.
          </span>
        </div>
        {files.length > 0 && (
          <ul className="mt-3 space-y-1">
            {files.map((f) => (
              <li key={f.name} className="flex items-center gap-2 font-mono text-[12.5px]">
                <FileJson className="size-3.5 shrink-0 text-muted-foreground" />
                <span>{f.name}</span>
                {f.error ? (
                  <span className="text-red-600 dark:text-red-400">{f.error}</span>
                ) : (
                  <span className="text-muted-foreground">
                    {f.order.length} keys
                    {f.duplicateCount > 0 && (
                      <span className="text-amber-600 dark:text-amber-400">
                        {' '}
                        · {f.duplicateCount} duplicate {f.duplicateCount === 1 ? 'key' : 'keys'} (first at line {f.duplicates[0]?.line})
                      </span>
                    )}
                  </span>
                )}
                {files.length > 1 && (
                  <label className="ml-1 flex items-center gap-1 text-muted-foreground">
                    <input type="radio" name="i18n-base" checked={base === f.lang} onChange={() => { setBaseLang(f.lang); setFixes(null); }} disabled={!f.value} />
                    base
                  </label>
                )}
                <button className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => removeFile(f.name)} aria-label={`Remove ${f.name}`}>
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {parsed.length < 2 && (
        <div className="px-4 py-3 text-[13px] text-faint" aria-live="polite">
          Add at least two locale files to compare them, or load the example.
        </div>
      )}

      {report && (
        <>
          <div className="flex min-h-10 flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-2 font-mono text-[12.5px] text-muted-foreground" aria-live="polite">
            <span>
              base: <b className="font-medium text-foreground">{report.base}</b> ({report.baseKeys} keys)
            </span>
            {Object.entries(report.summary).map(([lang, s]) => (
              <span key={lang}>
                {lang}: {s.missing > 0 ? <b className="font-medium text-red-600 dark:text-red-400">{s.missing} missing</b> : '0 missing'}
                {s.untranslated > 0 && <> · {s.untranslated} untranslated</>}
                {s.empty > 0 && <> · {s.empty} empty</>}
                {s.placeholder > 0 && <> · <b className="font-medium text-red-600 dark:text-red-400">{s.placeholder} placeholder</b></>}
                {s.type > 0 && <> · {s.type} type</>}
                {s.extra > 0 && <> · {s.extra} extra</>}
              </span>
            ))}
            {issueCount === 0 && <span className="text-green-600 dark:text-green-400">No issues found.</span>}
          </div>

          {issueCount > 0 && (
            <div className="max-h-72 overflow-auto border-b px-4 py-2" aria-label="Issues">
              <table className="w-full text-[12.5px]">
                <tbody>
                  {report.issues.map((i, n) => (
                    <tr key={n} className="border-b border-border/50 last:border-0">
                      <td className="py-1 pr-2 font-mono text-muted-foreground">{i.lang}</td>
                      <td className={cn('py-1 pr-2 whitespace-nowrap', KIND_CLASS[i.kind])}>{KIND_LABEL[i.kind]}</td>
                      <td className="py-1 pr-2 font-mono">{i.key}</td>
                      <td className="py-1 text-muted-foreground">{i.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {extras.length > 0 && (
            <div className="border-b px-4 py-3">
              <div className="mb-1.5 text-[13px] font-medium">Extra keys (removed only if you tick them)</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {extras.map((i) => {
                  const id = extraId(i.lang, i.key);
                  return (
                    <label key={id} className="flex items-center gap-1.5 font-mono text-[12.5px] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={approvedExtras.has(id)}
                        onChange={(e) => {
                          setApprovedExtras((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(id);
                            else next.delete(id);
                            return next;
                          });
                          setFixes(null);
                        }}
                      />
                      {i.lang}: {i.key}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border-b px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={prepareFixes} disabled={issueCount === 0 && approvedExtras.size === 0 && !sortToBase}>
                Preview fixed files
              </Button>
              <span className="text-[12.5px] text-muted-foreground">
                {fillMissing === 'empty'
                  ? 'Missing keys are added as empty strings, ready to translate.'
                  : 'Missing keys get the base text and still count as untranslated in the re-check.'}
              </span>
            </div>
            {fixes && (
              <ul className="mt-3 space-y-1.5" aria-label="Fixed files">
                {Object.entries(fixes).map(([lang, r]) => (
                  <li key={lang} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                    <span className="font-mono">{lang}.json</span>
                    <span className="text-muted-foreground">
                      {r.filled.length > 0 && `${r.filled.length} filled (${fillMissing === 'base' ? 'untranslated' : 'empty'}) · `}
                      {r.removed.length > 0 && `${r.removed.length} removed · `}
                      {r.blocked.length > 0 && <span className="text-amber-600 dark:text-amber-400">{r.blocked.length} blocked by type conflicts · </span>}
                      {sortToBase && 'sorted'}
                      {r.filled.length === 0 && r.removed.length === 0 && r.blocked.length === 0 && !sortToBase && 'unchanged'}
                    </span>
                    <span className="ml-auto flex gap-1">
                      <Button variant="outline" size="xs" onClick={() => copyText(r.text, `${lang}.json copied`)} aria-label={`Copy fixed ${lang}.json`}>
                        Copy
                      </Button>
                      <Button variant="outline" size="xs" onClick={() => downloadFile(r.text, `${lang}.json`, 'application/json;charset=utf-8')} aria-label={`Download fixed ${lang}.json`}>
                        <Download /> Download
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </>
  );
}
