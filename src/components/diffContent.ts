import type { Variant } from '@/variant';
import type { PageId } from '@/site';
import type { Source, WorkedExample } from '@/tools/content';

interface DiffPageContent {
  title: string;
  description: string;
  stepsTitle: string;
  steps: { title: string; body: string }[];
  faq: { q: string; a: string }[];
  /** Real input and the diff checker's real output (checked by a test). */
  example?: WorkedExample;
  mistakes: { title: string; body: string }[];
  related: PageId[];
  sources: Source[];
}

/** Heading, how-to, FAQ and the rest of the guide for the two diff pages (/diff-checker/ and /json-diff/). */
export const DIFF_CONTENT: Record<Variant, DiffPageContent> = {
  text: {
    title: 'Diff checker',
    description: 'Compare two texts or files, line by line and word by word. Free, unlimited, and your text never leaves your browser.',
    stepsTitle: 'How to compare two texts',
    steps: [
      { title: 'Paste or drop both versions', body: 'The original goes on the left (a), the changed version on the right (b). Files are read on your machine, never uploaded.' },
      { title: 'Read the changes', body: 'Removed lines are red, added lines green, and changed words inside a line are marked. Jump between changes with the arrows.' },
      { title: 'Merge, share or export', body: 'Copy a change across with one click, share a link that carries both texts, download a .patch file, or save the comparison as a PDF.' },
    ],
    faq: [
      { q: 'Is there a size limit?', a: 'No fixed limit. Files with hundreds of thousands of lines work; the only limit is your browser’s memory.' },
      { q: 'Is my text uploaded?', a: 'No. The diff is computed in this tab and your text is never sent anywhere. The page sends only cookieless usage counts (which page and tool, plus basic browser details), never your input. Microsoft Clarity also records clicks and scrolling to show how pages are used, with tool areas hidden. Share links keep the texts in the part of the URL after #, which browsers never send.' },
      { q: 'Can it ignore whitespace or case?', a: 'Yes. Ignore whitespace, case, or lines matching your own patterns, and the diff updates instantly.' },
      {
        q: 'What is a diff?',
        a: 'A diff is the list of lines you would have to remove and add to turn one text into another. The diff checker finds the shortest such list using Myers’ algorithm, the same approach git uses, so unchanged lines are never shown as changed.',
      },
      {
        q: 'What is a .patch file?',
        a: 'The diff written in unified format, the format of diff -u and git diff: lines starting with - were removed, lines with + were added, and @@ lines say where each change is. Tools like git apply and patch can apply it to the original file.',
      },
    ],
    example: {
      intro: 'Two versions of a small config file. Two lines changed and one was added; Download .patch saves exactly this.',
      inputLabel: 'a (left) and b (right)',
      input: '# a: config.old.yml\nhost: localhost\nport: 8080\ndebug: true\nretries: 3\n\n# b: config.yml\nhost: localhost\nport: 9090\ndebug: false\nretries: 3\ntimeout: 30',
      outputLabel: 'unified diff (.patch)',
      output: '--- a/config.old.yml\n+++ b/config.yml\n@@ -1,4 +1,5 @@\n host: localhost\n-port: 8080\n-debug: true\n+port: 9090\n+debug: false\n retries: 3\n+timeout: 30\n',
      note: 'In @@ -1,4 +1,5 @@, the old file’s lines 1–4 became the new file’s lines 1–5.',
    },
    mistakes: [
      { title: 'Putting the files on the wrong sides', body: 'The original goes on the left (a) and the new version on the right (b). Swapped, every addition shows as a removal. The swap button fixes it in one click.' },
      { title: 'Comparing files with different line endings', body: 'A file saved on Windows ends lines with CRLF, so every line can look changed. Turn on Ignore whitespace to compare the text only.' },
      { title: 'Diffing minified or reordered JSON as text', body: 'One long line, or the same keys in a different order, hides the real change. Use the JSON diff, which formats both sides and sorts keys first.' },
      { title: 'Sharing a link with private text', body: 'A share link carries both texts inside it. Anyone with the link can read them, so don’t share links to passwords, keys or private data.' },
    ],
    related: ['json-diff', 'guide-compare-files', 'guide-compare-json', 'code-beautifier', 'line-cleaner'],
    sources: [
      { title: 'An O(ND) Difference Algorithm and Its Variations (Myers, 1986)', url: 'https://doi.org/10.1007/BF01840446', about: 'the algorithm the diff checker uses to find the shortest set of changes' },
      { title: 'git diff documentation', url: 'https://git-scm.com/docs/git-diff', about: 'the unified diff format used by Download .patch' },
    ],
  },
  json: {
    title: 'JSON diff',
    description: 'Compare two JSON files and see every changed key and value. Format and sort keys in one click, so only real changes show.',
    stepsTitle: 'How to compare two JSON files',
    steps: [
      { title: 'Paste or drop both files', body: 'Put the old JSON on the left (a) and the new JSON on the right (b). Files are read on your machine, never uploaded.' },
      {
        title: 'Format and sort keys',
        body: 'Minified JSON and keys in a different order would otherwise look like changes. Format JSON & sort keys pretty-prints both sides with keys A–Z, leaving only real differences.',
      },
      { title: 'Read the changes', body: 'Changed values are marked word by word, added keys in green, removed keys in red. Invalid JSON is flagged with the exact line and column.' },
    ],
    faq: [
      { q: 'Does key order count as a change?', a: 'Not after Format JSON & sort keys: both sides are sorted A–Z, so reordered keys line up and only real changes show.' },
      { q: 'What kinds of JSON work?', a: 'API responses, config files, package.json, translation files and any other JSON, up to hundreds of thousands of lines.' },
      { q: 'Is my JSON uploaded?', a: 'No. Everything happens in this tab; your JSON is never sent anywhere.' },
    ],
    mistakes: [
      { title: 'Comparing before formatting', body: 'Minified JSON is one long line, so the whole file shows as changed. Click Format JSON & sort keys first.' },
      { title: 'Treating key order as a change', body: 'In JSON, {"a":1,"b":2} and {"b":2,"a":1} hold the same data. Sorting keys on both sides shows only real changes.' },
      { title: 'Missing type changes', body: '1 and "1" look alike but are a number and a string. The diff marks the quotes, so check changed values closely.' },
      { title: 'Comparing invalid JSON', body: 'A trailing comma or single quotes make the file invalid, and it can’t be formatted. Fix it in the JSON validator first; the error shows the exact line.' },
    ],
    related: ['diff-checker', 'guide-compare-json', 'json-formatter', 'json-validator'],
    sources: [
      { title: 'RFC 8259: The JSON Data Interchange Format', url: 'https://datatracker.ietf.org/doc/html/rfc8259', about: 'the JSON standard, including why object key order carries no meaning' },
      { title: 'An O(ND) Difference Algorithm and Its Variations (Myers, 1986)', url: 'https://doi.org/10.1007/BF01840446', about: 'the algorithm used to find the shortest set of changes' },
    ],
  },
};
