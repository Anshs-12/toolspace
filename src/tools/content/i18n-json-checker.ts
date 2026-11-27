import type { ToolContent } from '../content';

const content: ToolContent = {
  h1: 'i18n JSON checker',
  lede: 'Drop in your JSON locale files, one per language, and see what has drifted: missing keys, extra keys, empty or untranslated strings, placeholder mismatches and duplicate keys. Fix the gaps and download the synced files. Runs in your browser; files are never uploaded or saved.',
  steps: [
    { title: 'Add your locale files', body: 'Drop in the JSON files, one per language (en.json, de.json, ...), or pick them from your disk. They are read in this tab only.' },
    { title: 'Read the report', body: 'Each language is compared against the base: which keys are missing, which are extra, which values are empty, identical to the base, or use different {{placeholders}}.' },
    { title: 'Fix and download', body: 'Preview what changes, then download each fixed file. Missing keys are filled with empty strings (or the base text, still marked untranslated), keys are sorted like the base, and extra keys are removed only where you ticked them.' },
  ],
  faq: [
    { q: 'What does the checker look for?', a: 'Missing keys versus the base file, extra keys, empty strings, values identical to the base (usually untranslated), placeholder mismatches like {{name}} versus {{username}}, value type mismatches, and duplicate keys inside one file.' },
    { q: 'Does it translate anything?', a: 'No. Filling a missing key inserts an empty string, or a copy of the base text if you choose that. Base-filled values still count as untranslated in the re-check, so nothing looks translated that isn’t.' },
    { q: 'Are my files uploaded anywhere?', a: 'No. The files are read in your browser tab and never sent to a server or saved. Closing the tab discards them.' },
    { q: 'Will it delete keys on its own?', a: 'No. Extra keys are listed for review and removed only where you tick them. Duplicate keys are reported with their line numbers but never merged automatically.' },
    { q: 'Which placeholder styles are compared?', a: 'i18next-style {{name}} (including formats like {{count, number}}) and ICU-style {name}. printf-style %s placeholders are not compared yet.' },
    { q: 'Which file format is supported?', a: 'JSON locale files with a flat or nested key structure, as used by i18next, react-intl (compiled), vue-i18n and similar libraries. YAML, ARB, PO and XLIFF are not supported yet.' },
  ],
  mistakes: [
    { title: 'Shipping a placeholder mismatch', body: 'A translation with {{username}} where the base has {{name}} renders a broken string at runtime. The checker compares placeholders per key so these show up before release.' },
    { title: 'Deleting extra keys without reviewing them', body: 'An extra key can be a leftover, or a translation the base file lost. Review the list and tick only the keys you actually want removed.' },
    { title: 'Counting base-filled keys as done', body: 'Copying the base text into a missing key is a placeholder, not a translation. The re-check keeps counting those values as untranslated so they stay on the list.' },
  ],
  related: ['json-validator', 'json-diff', 'json-formatter', 'json-viewer', 'guide-json-errors'],
  sources: [
    { title: 'i18next documentation: interpolation', url: 'https://www.i18next.com/translation-function/interpolation', about: 'the {{name}} placeholder syntax the checker compares' },
    { title: 'Unicode MessageFormat (ICU) syntax', url: 'https://unicode-org.github.io/icu/userguide/format_parse/messages/', about: 'the {name} message-format placeholders the checker compares' },
  ],
};

export default content;
