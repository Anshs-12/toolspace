import type { PageId } from '@/site';
// The newer tools' text; those files import only types from here, so there is no cycle at runtime
import { NEW_TOOL_CONTENT } from './content/index';

/** Example document shared by the JSON tools. */
export const EXAMPLE_JSON = `[
  {
    "id": 1,
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "active": true,
    "address": { "city": "London", "country": "UK" },
    "roles": ["admin", "editor"],
    "lastLogin": "2026-10-14T09:12:00Z"
  },
  {
    "id": 2,
    "name": "Grace Hopper",
    "email": "grace@example.com",
    "active": false,
    "address": { "city": "Arlington", "country": "US" },
    "roles": ["editor"],
    "lastLogin": null
  },
  {
    "id": 3,
    "name": "Alan Turing",
    "email": "alan@example.com",
    "active": true,
    "address": { "city": "Manchester", "country": "UK" },
    "roles": [],
    "note": "Prefers \\"tea\\", not coffee"
  }
]
`;

export interface ToolContent {
  h1: string;
  lede: string;
  /** "How it works" steps. */
  steps: { title: string; body: string }[];
  /** Short questions and answers (what people search for). */
  faq: { q: string; a: string }[];
  /** A worked example: real input and the tool's real output (checked by a test). */
  example?: WorkedExample;
  /** Mistakes people commonly make with this kind of task. */
  mistakes?: { title: string; body: string }[];
  /** Other pages worth linking from this one ("Related tools"). */
  related?: PageId[];
  /** Standards and references behind the page's claims, shown under "Sources" (a test checks they're https and unique). */
  sources?: Source[];
}

/** An outside reference: what it is, and what on the page it backs up. */
export interface Source {
  title: string;
  url: string;
  /** What it covers, in a few words ("the JSON standard the validator follows"). */
  about: string;
}

export interface WorkedExample {
  intro: string;
  inputLabel: string;
  input: string;
  outputLabel: string;
  output: string;
  note?: string;
}

export type ToolId = Exclude<PageId, 'home' | 'diff-checker' | 'json-diff' | 'guide-compare-json' | 'guide-json-to-csv' | 'guide-compare-files' | 'about' | 'contact'>;

export const TOOL_CONTENT: Record<ToolId, ToolContent> = {
  ...NEW_TOOL_CONTENT,
  'json-formatter': {
    h1: 'JSON formatter',
    lede: 'Beautify messy JSON or minify it to one line. Pick the indentation, sort keys if you like, and copy or download the result. It all runs in your browser.',
    steps: [
      { title: 'Paste or open your JSON', body: 'Paste it on the left, or open a .json file. Files are read on your machine and never uploaded.' },
      { title: 'Choose the style', body: '2 or 4 spaces, tabs, or minified to a single line. Turn on Sort keys to order every object A–Z.' },
      { title: 'Copy or download', body: 'The formatted JSON updates as you type. Syntax errors are shown with their exact line and column.' },
    ],
    faq: [
      {
        q: 'Does formatting change my data?',
        a: 'Values, types and array order stay the same, and numbers are kept exactly as written: 1.0 stays 1.0 and long IDs are never rounded. Two exceptions, both flagged with a warning: if a key appears twice in one object, only the last value is kept, and number-like keys such as "1" move to the front of their object, a rule every browser applies.',
      },
      { q: 'Is there a size limit?', a: 'No fixed limit. Files of tens of megabytes work; the only limit is your browser’s memory.' },
      { q: 'Is my JSON sent anywhere?', a: 'No. Formatting happens in this tab and your JSON is never sent anywhere. The page sends only cookieless usage counts (which page and tool, plus basic browser details), never your input. Microsoft Clarity also records clicks and scrolling to show how pages are used, with tool areas hidden.' },
    ],
    example: {
      intro: 'A one-line API response, formatted with 2 spaces. The price keeps its trailing zero: 1.10 stays 1.10, where JSON.parse and most formatters would turn it into 1.1.',
      inputLabel: 'minified',
      input: '{"id":7,"name":"Ada","tags":["admin","editor"],"price":1.10,"active":true}',
      outputLabel: 'formatted (2 spaces)',
      output: '{\n  "id": 7,\n  "name": "Ada",\n  "tags": [\n    "admin",\n    "editor"\n  ],\n  "price": 1.10,\n  "active": true\n}\n',
    },
    mistakes: [
      { title: 'Pasting JavaScript instead of JSON', body: 'Unquoted keys, single quotes, comments and trailing commas are fine in JavaScript but not in JSON. The error points at the first one.' },
      { title: 'Expecting the formatter to fix errors', body: 'Formatting needs valid JSON to start from. Fix the line in the error message first; the JSON validator explains each kind of error.' },
      { title: 'Sorting keys in a file people edit', body: 'Sort keys is useful before comparing two files, but it reorders the whole file. Leave it off to keep the original order.' },
      { title: 'Sending formatted JSON from an API', body: 'Indentation and line breaks add bytes to every response. Send it minified and format it only when you need to read it.' },
    ],
    sources: [
      { title: 'RFC 8259: The JSON Data Interchange Format', url: 'https://datatracker.ietf.org/doc/html/rfc8259', about: 'the JSON standard the formatter and validator follow' },
      { title: 'JSON.parse() on MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse', about: 'how browsers read JSON, and the rules it shares with this page' },
    ],
    related: ['json-validator', 'json-viewer', 'json-diff', 'json-to-typescript'],
  },
  'json-validator': {
    h1: 'JSON validator',
    lede: 'Check whether your JSON is valid, and if it isn’t, see exactly where and why: the line, the column and a plain explanation. Runs in your browser.',
    steps: [
      { title: 'Paste or open your JSON', body: 'It is checked as you type, so you can fix it in place.' },
      { title: 'Read the result', body: 'Valid JSON shows a summary of its structure. Invalid JSON shows the first error, with the line highlighted.' },
      { title: 'Jump to the error', body: 'Go to error puts the cursor right where the problem is. Common causes: trailing commas, single quotes, unquoted keys. Once it’s valid, the buttons above the editor copy it formatted or minified.' },
    ],
    faq: [
      { q: 'Why is my JSON invalid?', a: 'The usual suspects are a comma after the last item, keys or strings in single quotes, unquoted keys, comments, or a missing closing bracket. JSON is stricter than JavaScript.' },
      { q: 'Which JSON standard is used?', a: 'Strict JSON (RFC 8259), the same rules as JSON.parse in every browser.' },
      { q: 'Does it catch duplicate keys?', a: 'Yes. Duplicate keys are technically allowed, so the JSON still counts as valid, but you get a warning with the line and column, because most parsers silently keep only the last value.' },
      { q: 'Is my JSON sent anywhere?', a: 'No. Validation happens in this tab; your JSON is never uploaded.' },
    ],
    example: {
      intro: 'JSON copied from JavaScript code, with a comma after the last item. The validator names the problem and its exact place.',
      inputLabel: 'json',
      input: '{\n  "name": "Ada",\n  "roles": ["admin", "editor",],\n}',
      outputLabel: 'result',
      output: 'Trailing comma before "]" at line 3, column 31',
      note: 'Remove that comma and the validator reports the next one: the comma at the end of line 3, before the closing } on line 4.',
    },
    mistakes: [
      { title: 'Trailing commas', body: 'A comma after the last item of an object or array is allowed in JavaScript, but not in JSON.' },
      { title: 'Single quotes', body: 'JSON strings and keys need "double quotes". \'Ada\' is invalid.' },
      { title: 'Comments', body: 'JSON has no comments. Files like tsconfig.json accept them, but strict parsers don’t; use YAML or JSON5 if you need them.' },
      { title: 'Missing quotes around keys', body: '{name: "Ada"} is a JavaScript object, not JSON. Every key must be a quoted string.' },
      { title: 'Special values', body: 'Values like undefined, NaN and Infinity are not JSON. Use null, or a string if you need to keep the value.' },
    ],
    sources: [
      { title: 'RFC 8259: The JSON Data Interchange Format', url: 'https://datatracker.ietf.org/doc/html/rfc8259', about: 'the JSON standard, which defines what valid JSON is' },
      { title: 'JSON.parse() on MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse', about: 'the browser parser that applies the same rules' },
    ],
    related: ['json-formatter', 'yaml-validator', 'json-viewer', 'json-diff'],
  },
  'json-to-csv': {
    h1: 'JSON to CSV converter',
    lede: 'Turn a JSON array into a CSV file you can open in Excel, Google Sheets or Numbers, or turn a CSV file back into JSON. Nested objects become columns like address.city. Runs in your browser.',
    steps: [
      { title: 'Pick the direction and paste', body: 'JSON → CSV takes an array of objects: each object becomes a row, and an API response like {"data": [...]} uses its array automatically. CSV → JSON takes any CSV or TSV file, with or without a header row.' },
      { title: 'Choose the options', body: 'For CSV: comma, semicolon or tab, and whether to escape formulas. For JSON: the delimiter (detected unless you pick one), whether the first row holds the keys, number and true/false detection, and rebuilding nested objects from dotted headers.' },
      { title: 'Copy or download', body: 'Columns are every key found, in the order first seen, and lists inside a row are kept as JSON in one cell. The JSON side is formatted with 2-space indentation.' },
    ],
    faq: [
      { q: 'How are nested objects handled?', a: 'They are flattened into dotted column names: {"address": {"city": "London"}} becomes a column address.city. Going the other way, Nest dotted keys turns address.city back into a nested object.' },
      { q: 'What about arrays inside objects?', a: 'They are written into a single cell as JSON text (for example ["admin","editor"]), so no data is lost. CSV → JSON reads them back as arrays when number and true/false detection is on.' },
      { q: 'Will Excel open it correctly?', a: 'Yes. Downloads start with a UTF-8 byte order mark, so accented letters and emoji show correctly in Excel. Escape formulas is on by default, so cells starting with = + - or @ can’t run as formulas; turn it off if you need those cells exactly as they are.' },
      { q: 'Why are my numbers strings in the JSON?', a: 'CSV has no types, so every value stays a string unless you turn on number and true/false detection. Even then, values that would change are kept as text: IDs with leading zeros like 007, 1.10, and numbers too long to store exactly.' },
      { q: 'Which CSV files can it read?', a: 'Standard CSV (RFC 4180): quoted fields with commas, line breaks or doubled quotes ("") inside, Windows or Unix line endings, and a byte order mark at the start. An unclosed quote is reported with its line and column.' },
      { q: 'Is my data uploaded?', a: 'No. The conversion runs in this tab; your data never leaves your browser.' },
    ],
    example: {
      intro: 'Two users. The nested address.city gets its own column, and the roles list stays as JSON in a single cell, with its quotes doubled as CSV requires.',
      inputLabel: 'json',
      input: '[{"id":1,"name":"Ada","address":{"city":"London"},"roles":["admin","editor"]},{"id":2,"name":"Grace","address":{"city":"Arlington"},"roles":[]}]',
      outputLabel: 'csv',
      output: 'id,name,address.city,roles\n1,Ada,London,"[""admin"",""editor""]"\n2,Grace,Arlington,[]\n',
    },
    mistakes: [
      { title: 'Turning off formula escaping for data you didn’t write', body: 'A cell starting with =, +, - or @ can run as a formula when the file is opened in a spreadsheet (CSV injection). Keep Escape formulas on unless you need those cells exactly as they are.' },
      { title: 'Expecting types to survive a round trip', body: 'CSV stores only text. Turn on number and true/false detection when converting back, and expect IDs like 007 to stay text.' },
      { title: 'Using commas where Excel expects semicolons', body: 'In many European locales Excel splits columns on semicolons. If every row lands in one column, download with Semicolon instead.' },
      { title: 'Flattening very nested data', body: 'Every nested key becomes a column, so deep or uneven objects make very wide files. Pick out the array you need first, for example with the JSONPath tester.' },
    ],
    sources: [
      { title: 'RFC 4180: Common Format for CSV Files', url: 'https://datatracker.ietf.org/doc/html/rfc4180', about: 'the CSV rules for quoting, doubled quotes and line breaks' },
      { title: 'CSV Injection (OWASP)', url: 'https://owasp.org/www-community/attacks/CSV_Injection', about: 'why cells starting with = + - or @ are escaped' },
    ],
    related: ['csv-to-json', 'guide-json-to-csv', 'json-viewer', 'json-formatter', 'mock-json'],
  },
  'csv-to-json': {
    h1: 'CSV to JSON converter',
    lede: 'Turn a CSV or TSV file into JSON you can feed to an app or API. The first row becomes the keys, the delimiter is detected for you, and quoted cells with commas or line breaks inside are read correctly. Runs in your browser.',
    steps: [
      { title: 'Paste or open the CSV', body: 'Any standard CSV or TSV: comma, semicolon or tab separated, with Windows or Unix line endings. The delimiter is detected unless you pick one yourself.' },
      { title: 'Set how the rows are read', body: 'Keep Header row on to use the first row as the keys of each object, or turn it off for an array of arrays. Detect numbers and true/false converts 42, true and null; Nest dotted keys rebuilds columns like address.city into nested objects.' },
      { title: 'Copy or download the JSON', body: 'One object per row, formatted with 2-space indentation. Blank or repeated column names are given unique keys, and short rows are padded with empty strings, so no cell is silently dropped.' },
    ],
    faq: [
      { q: 'What JSON do I get back?', a: 'With a header row, an array of objects: each row becomes one object keyed by the column names. Without one, an array of arrays, one inner array per row, so position carries the meaning.' },
      { q: 'Can it read cells that contain commas or line breaks?', a: 'Yes. Standard CSV quoting is followed (RFC 4180): a field wrapped in double quotes may contain the delimiter, doubled quotes and line breaks. A quote that is never closed is reported with the line and column where it opened, and the Go to error button jumps there.' },
      { q: 'How do I get numbers instead of strings?', a: 'Turn on Detect numbers and true/false. Values like 42, 3.14, true, false and null become JSON values, and cells holding a JSON list or object are read back as such. Anything that would change as a number stays text: IDs with leading zeros like 007, values like 1.10, and numbers too long to store exactly.' },
      { q: 'The whole file landed in one column. What happened?', a: 'The delimiter guess was wrong, which happens with files that mix separators. Pick the delimiter yourself in the toolbar: Comma, Semicolon or Tab. Semicolons are common in exports from Excel in many European locales.' },
      { q: 'What about nested data, like an address.city column?', a: 'Turn on Nest dotted keys and columns with dots in their names become nested objects again, so address.city ends up as {"address": {"city": ...}}. Names that would clash or have an empty part stay flat.' },
      { q: 'Is my file uploaded anywhere?', a: 'No. The conversion runs in this tab; your data never leaves your browser. The page sends only cookieless usage counts (which page and tool, plus basic browser details), never your input. Microsoft Clarity also records clicks and scrolling to show how pages are used, with tool areas hidden.' },
    ],
    example: {
      intro: 'A three-column export. The roles cell holds a JSON list, so with type detection on it comes back as a real array; without it the cell stays a string.',
      inputLabel: 'csv',
      input: 'id,name,roles\n1,Ada,"[""admin"",""editor""]"\n2,Grace,[]',
      outputLabel: 'json',
      output: '[\n  {\n    "id": "1",\n    "name": "Ada",\n    "roles": "[\"admin\",\"editor\"]"\n  },\n  {\n    "id": "2",\n    "name": "Grace",\n    "roles": "[]"\n  }\n]',
    },
    mistakes: [
      { title: 'Expecting numbers to survive CSV', body: 'CSV stores only text, so every cell is a string until Detect numbers and true/false is on. Even then, values that would change stay text: 007 keeps its leading zeros and 1.10 keeps its trailing zero.' },
      { title: 'Leaving Header row on for data without one', body: 'The first row of real data becomes the keys and disappears from the result. Turn Header row off to get an array of arrays instead.' },
      { title: 'Ignoring the line and column in an error', body: 'An unclosed quote almost always means an export or paste dropped a closing quote, and every row after it reads wrong. The error names the line and column where the quote opened; fix the source there, not by editing later rows.' },
      { title: 'Reformatting before converting', body: 'There is no need to clean the file first. A byte order mark, CRLF or LF endings, blank lines and quoted line breaks are all handled; converting the original export avoids introducing new mistakes.' },
    ],
    sources: [
      { title: 'RFC 4180: Common Format for CSV Files', url: 'https://datatracker.ietf.org/doc/html/rfc4180', about: 'the quoting, doubled-quote and line-break rules this converter follows' },
      { title: 'The JSON Data Interchange Syntax (ECMA-404)', url: 'https://ecma-international.org/publications-and-standards/standards/ecma-404/', about: 'the JSON grammar the output is written in' },
    ],
    related: ['json-to-csv', 'json-formatter', 'json-validator', 'json-viewer'],
  },
  'json-to-yaml': {
    h1: 'JSON to YAML converter',
    lede: 'Convert JSON into clean, valid YAML for configs, Kubernetes manifests or CI files, or YAML back into JSON. Strings are quoted only when YAML would misread them. Runs in your browser.',
    steps: [
      { title: 'Pick the direction and paste', body: 'JSON → YAML takes any valid JSON: objects, arrays or a single value. YAML → JSON takes any YAML file, including comments, anchors and several documents.' },
      { title: 'Get the result as you type', body: 'YAML comes out in block style with 2-space indentation, and values like "yes", "on", "1.0" or "null" stay strings by being quoted. JSON comes out with 2-space indentation; YAML errors show their line and column.' },
      { title: 'Copy or download', body: 'Save it as a .yaml or .json file, or paste it straight into your config or code.' },
    ],
    faq: [
      { q: 'Why are some strings quoted?', a: 'YAML reads bare words like yes, no, on, off, null and numbers as booleans, null or numbers. Quoting keeps them as the strings they were in your JSON.' },
      { q: 'Is the output valid YAML?', a: 'Yes. It reads back to exactly the same data in both YAML 1.1 and 1.2 parsers; this is checked on thousands of tricky inputs in our tests.' },
      { q: 'How is YAML read when converting to JSON?', a: 'As YAML 1.2, the current version, so a bare yes or off stays a string rather than becoming true or false. Anchors, aliases and << merge keys are expanded, comments are dropped, and long integers keep every digit.' },
      { q: 'What happens to YAML that JSON can’t hold?', a: 'Several documents separated by --- become one JSON array. Infinity and NaN become null, and keys that aren’t strings, like 1 or true, become strings. The status line tells you when this happens.' },
      { q: 'Is my data uploaded?', a: 'No. The conversion runs in this tab.' },
    ],
    example: {
      intro: 'A small service config. "yes" and "1.10" are strings in the JSON, so they are quoted in the YAML; otherwise YAML would read them as true and 1.1.',
      inputLabel: 'json',
      input: '{"name":"web","replicas":3,"enabled":"yes","version":"1.10","ports":[80,443],"env":{"MODE":"prod","DEBUG":false}}',
      outputLabel: 'yaml',
      output: 'name: web\nreplicas: 3\nenabled: "yes"\nversion: "1.10"\nports:\n- 80\n- 443\nenv:\n  MODE: prod\n  DEBUG: false\n',
    },
    mistakes: [
      { title: 'The Norway problem', body: 'In YAML 1.1, unquoted yes, no, on, off (and NO, the country code for Norway) become booleans. Quote them when they are meant as text.' },
      { title: 'Versions turning into numbers', body: '1.10 unquoted is the number 1.1, and 1.0 becomes 1. Quote version strings.' },
      { title: 'Tabs for indentation', body: 'YAML forbids tabs for indentation; a single tab makes the file invalid. Use spaces.' },
      { title: 'A colon inside a value', body: 'An unquoted "key: value: more" starts a new mapping. Quote values that contain ": " or start with characters like @, `, * or &.' },
      { title: 'Leading zeros', body: 'File modes like 0755 are read as octal numbers in YAML 1.1. Quote them to keep the exact text.' },
    ],
    sources: [
      { title: 'YAML 1.2.2 specification', url: 'https://yaml.org/spec/1.2.2/', about: 'the YAML version used when reading YAML' },
      { title: 'RFC 8259: The JSON Data Interchange Format', url: 'https://datatracker.ietf.org/doc/html/rfc8259', about: 'the JSON standard' },
    ],
    related: ['yaml-validator', 'json-formatter', 'json-to-typescript'],
  },
  'json-viewer': {
    h1: 'JSON viewer',
    lede: 'Explore JSON as a collapsible tree, a table or formatted text. Expand what you need, search keys and values, and click any value to copy its path. Runs in your browser.',
    steps: [
      { title: 'Paste or open your JSON', body: 'API responses, logs, configs: anything valid. Large files stay fast because only open branches are drawn. The input side can switch to a tree or table too.' },
      { title: 'Pick a view', body: 'Tree to expand branches and search keys and values. Table to see an array of objects as rows, with one column per key. Text for the whole document, formatted.' },
      { title: 'Copy paths and values', body: 'Click a row or a table cell to copy its path, like $.users[0].email, ready for code or jq-style tools. Copy full JSON copies the whole document, formatted.' },
    ],
    faq: [
      { q: 'How big a file can it open?', a: 'Large ones. Only expanded branches are rendered, so a file with hundreds of thousands of values still opens instantly. The table shows the first 1,000 rows and says how many there are in all.' },
      { q: 'What does the path look like?', a: 'JavaScript style: $.users[0].address.city, with ["odd key"] for keys that contain spaces or symbols.' },
      { q: 'What does the table show for data that isn’t a list?', a: 'An array of objects gets one row per item and one column per key, in the order keys first appear. An object gets a row per key, an array of plain values a row per item, and nested values are shown as short one-line JSON.' },
      { q: 'Is my JSON sent anywhere?', a: 'No. Everything happens in this tab.' },
    ],
    example: {
      intro: 'Two users; clicking the email of the first and the first-name of the second copies these paths. Keys with a dash need bracket notation.',
      inputLabel: 'json',
      input: '{"users":[{"email":"ada@example.com"},{"first-name":"Grace"}]}',
      outputLabel: 'copied paths',
      output: '$.users[0].email\n$.users[1]["first-name"]',
    },
    mistakes: [
      { title: 'Dot notation for odd keys', body: 'Keys with spaces, dashes or starting with a digit need brackets: $.user["first-name"], not $.user.first-name.' },
      { title: 'Counting from one', body: 'Arrays are zero-indexed: the first item is [0], the third is [2].' },
      { title: 'Mixing path styles', body: 'Paths here are JavaScript style ($.a[0].b). jq writes the same path as .a[0].b: drop the $.' },
      { title: 'Searching with one letter', body: 'Search starts at two characters, so a single letter doesn’t filter the tree.' },
    ],
    related: ['json-formatter', 'json-to-csv', 'json-diff', 'json-to-typescript'],
  },
  base64: {
    h1: 'Base64 encode and decode',
    lede: 'Turn text or a file into Base64, or Base64 back into text, an image or a file. Handles UTF-8, the URL-safe alphabet and missing padding. Runs in your browser.',
    steps: [
      { title: 'Pick encode or decode', body: 'Encode turns text into Base64. Decode turns Base64 back into text, or into a file if it holds binary data like an image or PDF.' },
      { title: 'Paste text or open a file', body: 'Any size works. Files are read on your machine and never uploaded. Decoding accepts data: URLs, line breaks and both alphabets.' },
      { title: 'Copy or download', body: 'Images show a preview, other binary data a hex view with a download button. Errors point at the exact character.' },
    ],
    faq: [
      { q: 'What is Base64?', a: 'A way to write any bytes using only 64 safe characters (A–Z, a–z, 0–9, + and /), so binary data can travel through text: JSON, email, URLs, data: URLs and HTTP headers. It is an encoding, not encryption: anyone can decode it.' },
      { q: 'What is URL-safe Base64?', a: 'The same encoding with - and _ instead of + and /, usually without = padding (RFC 4648 §5). JWTs and many URLs use it. Decoding here accepts both automatically.' },
      { q: 'Why is my decoded text garbled?', a: 'Either the data isn’t text (an image or a zip, for example), or the text was encoded from something other than UTF-8. Binary data is shown as a hex view with a download instead.' },
      { q: 'Is my data uploaded?', a: 'No. Encoding and decoding happen in this tab and your data is never sent anywhere. The page sends only cookieless usage counts (which page and tool, plus basic browser details), never your input. Microsoft Clarity also records clicks and scrolling to show how pages are used, with tool areas hidden.' },
    ],
    example: {
      intro: 'Three short texts, each encoded on its own. Every 3 bytes become 4 characters, so Base64 is about a third longer than the original, and = pads the end when the length isn’t a multiple of 3. In café ☕, é takes 2 bytes and ☕ takes 3 in UTF-8.',
      inputLabel: 'text',
      input: 'Hello, world!\ncafé ☕\n<<???>>',
      outputLabel: 'base64',
      output: 'SGVsbG8sIHdvcmxkIQ==\nY2Fmw6kg4piV\nPDw/Pz8+Pg==',
      note: 'URL-safe Base64 writes the last one as PDw_Pz8-Pg: - and _ instead of + and /, and no padding.',
    },
    mistakes: [
      { title: 'Using Base64 to hide secrets', body: 'Base64 is an encoding, not encryption. Anyone can decode it, so it protects nothing on its own.' },
      { title: 'Putting standard Base64 in a URL', body: '+ and / have meanings in URLs and get changed on the way. Use the URL-safe alphabet for URLs, file names and JWTs.' },
      { title: 'Calling btoa() on any text', body: 'JavaScript’s btoa() accepts only characters up to U+00FF, so btoa("☕") throws an error. Encode the text to UTF-8 bytes first, as this tool does.' },
      { title: 'Embedding large images as data: URLs', body: 'The Base64 is about a third bigger than the file, and browsers can’t cache it separately. Keep data: URLs for small icons.' },
    ],
    sources: [
      { title: 'RFC 4648: The Base16, Base32, and Base64 Data Encodings', url: 'https://datatracker.ietf.org/doc/html/rfc4648', about: 'the Base64 alphabets, padding and the URL-safe variant (section 5)' },
      { title: 'btoa() on MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Window/btoa', about: 'why the built-in function fails on characters beyond Latin-1' },
    ],
    related: ['hash-generator', 'url-encoder', 'jwt-decoder', 'html-entities'],
  },
  'unix-timestamp': {
    h1: 'Unix timestamp converter',
    lede: 'Convert epoch time to a readable date and back. Seconds, milliseconds, microseconds and nanoseconds are detected automatically, in any time zone. Runs in your browser.',
    steps: [
      { title: 'Paste a timestamp or a date', body: '1760700000, 1760700000000, 2026-10-17T12:00:00Z or Sat, 17 Oct 2026 12:00:00 GMT all work. The unit is detected from the number’s size.' },
      { title: 'Read every format at once', body: 'UTC and local time, ISO 8601, RFC 2822, relative time, the weekday, ISO week and day of the year, plus the timestamp in every unit.' },
      { title: 'Pick a time zone or copy', body: 'Show the date in any time zone. Each value has a copy button; the live clock at the top gives the current timestamp.' },
    ],
    faq: [
      { q: 'What is a Unix timestamp?', a: 'The number of seconds since 1 January 1970 00:00:00 UTC (the Unix epoch), ignoring leap seconds. It is the same everywhere in the world, which is why systems store time this way.' },
      { q: 'Seconds or milliseconds?', a: 'Unix tools and most APIs use seconds (10 digits today); JavaScript’s Date.now() and Java use milliseconds (13 digits). Microseconds (16) and nanoseconds (19) appear in databases and tracing. The converter detects which one you pasted.' },
      { q: 'What is the year 2038 problem?', a: 'Systems that store seconds in a signed 32-bit integer overflow on 19 January 2038 at 03:14:07 UTC (timestamp 2147483647). 64-bit timestamps, used here, run for billions of years.' },
      { q: 'Is anything sent to a server?', a: 'No. All conversion uses your browser’s own clock and time zone data.' },
    ],
    example: {
      intro: 'The same moment in seconds and in milliseconds. The converter tells them apart by the number of digits.',
      inputLabel: 'timestamp',
      input: '1760700000\n1760700000000',
      outputLabel: 'ISO 8601 (UTC)',
      output: '2025-10-17T11:20:00Z\n2025-10-17T11:20:00Z',
    },
    mistakes: [
      { title: 'Mixing seconds and milliseconds', body: 'Read as milliseconds, 1760700000 is a date in January 1970. If a date lands in 1970 or far in the future, the unit is wrong.' },
      { title: 'Storing local time', body: 'A timestamp is always UTC. Convert to a time zone only when you show the date to someone.' },
      { title: 'Saving it in a 32-bit integer', body: 'A signed 32-bit number of seconds runs out on 19 January 2038. Use a 64-bit type.' },
      { title: 'Adding 86,400 seconds for “tomorrow”', body: 'Days with a daylight saving change last 23 or 25 hours in local time. Add calendar days in the time zone instead.' },
    ],
    sources: [
      { title: 'POSIX: Seconds Since the Epoch (The Open Group)', url: 'https://pubs.opengroup.org/onlinepubs/9799919799/basedefs/V1_chap04.html', about: 'the definition of Unix time, which ignores leap seconds' },
      { title: 'Date.now() on MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/now', about: 'why JavaScript counts in milliseconds' },
    ],
    related: ['cron-generator', 'jwt-decoder', 'uuid-generator'],
  },
  'jwt-decoder': {
    h1: 'JWT decoder',
    lede: 'Paste a JSON Web Token to read its header and payload, see when it expires, and verify its signature with a secret or a public key. Your token never leaves your browser.',
    steps: [
      { title: 'Paste the token', body: 'The whole eyJ… string, with or without "Bearer ". Header and payload are decoded as you paste, each claim labelled.' },
      { title: 'Check the dates', body: 'Issued at, not before and expiry are shown as dates, with whether the token is valid right now.' },
      { title: 'Verify the signature', body: 'Enter the secret for HS256/384/512, or a PEM or JWK public key for RS, PS, ES and EdDSA. Verification uses your browser’s built-in crypto.' },
    ],
    faq: [
      { q: 'Is it safe to paste a real token?', a: 'Here, yes: decoding and verification run entirely in this tab and the token is never sent anywhere. The page sends only cookieless usage counts (which page and tool, plus basic browser details), never your input. Microsoft Clarity also records clicks and scrolling to show how pages are used, with tool areas hidden. Still, treat live tokens like passwords and prefer expired or test ones when you can.' },
      { q: 'Does decoding prove a token is genuine?', a: 'No. Anyone can decode a JWT; the payload is only Base64url, not encrypted. Only verifying the signature with the right key shows it hasn’t been tampered with.' },
      { q: 'Which algorithms can it verify?', a: 'HS256, HS384 and HS512 with a shared secret; RS256/384/512, PS256/384/512 and ES256/384/512 with a public key in PEM or JWK form; and EdDSA (Ed25519) in browsers that support it.' },
      { q: 'Can it decode encrypted tokens (JWE)?', a: 'No. Encrypted tokens have five parts and need the private key to read; this tool decodes signed tokens (JWS), the common kind.' },
    ],
    example: {
      intro: 'The well-known sample token from the JWT documentation. Its three parts are separated by dots: header, payload and signature.',
      inputLabel: 'token',
      input: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      outputLabel: 'header and payload',
      output: '{\n  "alg": "HS256",\n  "typ": "JWT"\n}\n{\n  "sub": "1234567890",\n  "name": "John Doe",\n  "iat": 1516239022\n}',
      note: 'iat (issued at) is 18 January 2018, 01:30:22 UTC. There is no exp claim, so this token never expires, which would be a problem for a real one.',
    },
    mistakes: [
      { title: 'Putting secrets in the payload', body: 'The payload is only Base64url, so anyone holding the token can read it. Keep passwords and personal data out.' },
      { title: 'Trusting a token you only decoded', body: 'Decoding shows what a token claims, not that it’s genuine. Servers must verify the signature before using any claim.' },
      { title: 'Letting the token choose the algorithm', body: 'A server that accepts whatever alg the header names can be tricked with "none" or a swapped key type. Fix the expected algorithm on the server.' },
      { title: 'Writing exp in milliseconds', body: 'exp, iat and nbf are seconds since 1970. A 13-digit value means a date thousands of years away.' },
    ],
    sources: [
      { title: 'RFC 7519: JSON Web Token (JWT)', url: 'https://datatracker.ietf.org/doc/html/rfc7519', about: 'the token format and its registered claims (exp, iat, nbf, sub and more)' },
      { title: 'RFC 7515: JSON Web Signature (JWS)', url: 'https://datatracker.ietf.org/doc/html/rfc7515', about: 'how the signature is made and checked' },
      { title: 'RFC 8725: JWT Best Current Practices', url: 'https://datatracker.ietf.org/doc/html/rfc8725', about: 'the algorithm and validation mistakes listed above' },
    ],
    related: ['base64', 'unix-timestamp', 'hash-generator', 'json-formatter'],
  },
  'regex-tester': {
    h1: 'Regex tester',
    lede: 'Write a regular expression and see every match highlighted as you type, with capture groups, named groups and a replace preview. Uses JavaScript’s regex engine, in your browser.',
    steps: [
      { title: 'Write the pattern', body: 'Type it without slashes and switch flags on or off: global, ignore case, multiline, dot-all, unicode and sticky. Syntax errors are explained as you type.' },
      { title: 'Paste test text', body: 'Matches are highlighted in place and listed below with their position and every capture group, numbered and named.' },
      { title: 'Try a replacement', body: 'Use $1, $<name> and $& to preview what String.replace would produce, then copy the result.' },
    ],
    faq: [
      { q: 'Which regex flavor is this?', a: 'JavaScript (ECMAScript), as in Chrome, Node.js and every browser. It is close to PCRE for everyday patterns; lookbehind, named groups and \\p{…} Unicode classes all work.' },
      { q: 'Why does my pattern freeze other testers?', a: 'Patterns like (a+)+$ can take exponential time on some inputs (catastrophic backtracking). Here the regex runs in a background worker and is stopped after 1.5 seconds, so the page stays responsive and you’re told why.' },
      { q: 'How many matches are shown?', a: 'Up to 10,000, which is enough for any text you’d check by eye. The count tells you if there are more.' },
      { q: 'Is my text uploaded?', a: 'No. Matching happens in this tab.' },
    ],
    mistakes: [
      { title: 'Forgetting the g flag', body: 'Without global, only the first match is found and only the first one is replaced.' },
      { title: 'A greedy .* matching too much', body: '".*" on two quoted words matches from the first quote to the last. Use ".*?" or "[^"]*" to stop at the nearest quote.' },
      { title: 'An unescaped dot', body: '. matches any character, so 1.5 also matches 105. Write \\. for a literal dot.' },
      { title: 'Expecting ^ and $ to match each line', body: 'They match the start and end of the whole text unless the multiline flag is on.' },
      { title: 'Nesting quantifiers', body: 'Patterns like (a+)+ can take exponential time on text that almost matches. Rewrite them without the nested repeat.' },
    ],
    sources: [
      { title: 'Regular expressions guide on MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions', about: 'the JavaScript regex syntax and flags this tester uses' },
      { title: 'Regular expression Denial of Service (OWASP)', url: 'https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS', about: 'catastrophic backtracking and why some patterns hang' },
    ],
    related: ['line-cleaner', 'list-to-sql', 'slug-generator'],
  },
  'url-encoder': {
    h1: 'URL encoder and decoder',
    lede: 'Percent-encode text for a URL or decode %20-style escapes back to text. Component, full-URL and form styles, with any URL broken into its parts. Runs in your browser.',
    steps: [
      { title: 'Pick encode or decode', body: 'Encode makes text safe to put in a URL; decode turns %-escapes back into readable text.' },
      { title: 'Choose the style', body: 'Component for a single query value or path segment, Full URL to keep : / ? # & intact, or Form for HTML form data where spaces become +.' },
      { title: 'Inspect the URL', body: 'Paste a full URL to see its protocol, host, port, path, hash and every query parameter decoded in a table.' },
    ],
    faq: [
      { q: 'encodeURIComponent or encodeURI?', a: 'Use component (encodeURIComponent) for a piece of a URL, like a query value: it escapes & = ? / and #. Use full URL (encodeURI) for a complete address, which must keep those characters.' },
      { q: 'Why do spaces become + sometimes and %20 other times?', a: 'HTML forms send data as application/x-www-form-urlencoded, where a space is +. Everywhere else in a URL a space is %20. Pick Form or Component to match what you’re working with.' },
      { q: 'Why does decoding fail?', a: 'A % must be followed by two hex digits, and the bytes must form valid UTF-8. The error says exactly which escape is wrong.' },
      { q: 'Is anything sent anywhere?', a: 'No. Encoding, decoding and parsing all happen in this tab.' },
    ],
    example: {
      intro: 'One query value in two styles. = & and / are escaped because they mean something in a URL, and € becomes three escapes, one for each of its UTF-8 bytes. Form style writes spaces as +.',
      inputLabel: 'text',
      input: 'price=10&currency=€ / month',
      outputLabel: 'Component · Form',
      output: 'price%3D10%26currency%3D%E2%82%AC%20%2F%20month\nprice%3D10%26currency%3D%E2%82%AC+%2F+month',
    },
    mistakes: [
      { title: 'Encoding a whole URL as a component', body: 'Component style escapes :// and every /, which breaks the link. Use Full URL for a complete address.' },
      { title: 'Encoding twice', body: 'Encoding already-encoded text turns %20 into %2520. Decode first if you’re not sure.' },
      { title: 'Using + for a space in a path', body: '+ means a space only in form data. In a path it’s a literal plus, so use %20 there.' },
      { title: 'Leaving & or = in a query value', body: 'An unescaped & starts a new parameter and cuts the value short. Encode each value with Component style.' },
    ],
    sources: [
      { title: 'RFC 3986: URI Generic Syntax', url: 'https://datatracker.ietf.org/doc/html/rfc3986', about: 'percent-encoding and which characters are reserved' },
      { title: 'URL Standard (WHATWG)', url: 'https://url.spec.whatwg.org/', about: 'how browsers parse URLs and encode form data with +' },
      { title: 'encodeURIComponent() on MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent', about: 'the difference between component and full-URL encoding' },
    ],
    related: ['base64', 'html-entities', 'slug-generator', 'qr-code'],
  },
  'case-converter': {
    h1: 'Case converter',
    lede: 'Change text to UPPER CASE, lower case, Sentence case or Title Case, or to camelCase, snake_case and kebab-case for code. Every format at once, as you type.',
    steps: [
      { title: 'Paste your text', body: 'Any length. Each line is converted separately for code cases, so a list of names converts one per line.' },
      { title: 'Pick a case', body: 'Click a case to show it in the output, or scan the preview of every case at once.' },
      { title: 'Copy the result', body: 'Copy or download. Accented letters and other alphabets convert correctly.' },
    ],
    faq: [
      { q: 'What is the difference between Title Case and Capitalized Case?', a: 'Capitalized Case capitalizes every word. Title Case follows style-guide rules and keeps short words like "of", "and" and "the" lowercase unless they start or end the title. For AP, APA or MLA rules, use the title case converter.' },
      { q: 'How does it split words for camelCase and snake_case?', a: 'At spaces, punctuation and existing case changes, so "parseHTTPRequest", "parse http request" and "parse-http-request" all become parse_http_request.' },
      { q: 'Is my text uploaded?', a: 'No. Conversion happens in this tab.' },
    ],
    related: ['title-case', 'slug-generator', 'line-cleaner', 'word-counter'],
  },
  'title-case': {
    h1: 'Title case converter',
    lede: 'Capitalize titles and headlines correctly in AP, Chicago, APA, MLA or New York Times style. Paste one headline or a whole list; acronyms, brand names and URLs stay as you wrote them.',
    steps: [
      { title: 'Paste your titles', body: 'One title or many, one per line: article headlines, chapter names, email subjects.' },
      { title: 'Choose a style guide', body: 'Each style lowercases different minor words. The rule is shown under the buttons.' },
      { title: 'Copy the result', body: 'First and last words, and the word after a colon, are always capitalized.' },
    ],
    faq: [
      { q: 'How do I capitalize a title?', a: 'Capitalize the first and last word and every major word (nouns, pronouns, verbs, adjectives and adverbs), and keep articles, short conjunctions and, depending on the style guide, prepositions lowercase. Paste the headline above and pick your style guide to have it done for you.' },
      { q: 'Which words stay lowercase in a title?', a: 'Usually articles (a, an, the), coordinating conjunctions (and, but, or, nor) and prepositions. Chicago and MLA lowercase prepositions of any length; AP and APA capitalize words of four letters or more, so "Between" and "With" are capitalized.' },
      { q: 'What about words like iPhone or NASA?', a: 'Words that already have capitals inside them, all-caps acronyms and URLs are left exactly as written.' },
      { q: 'Which style should I use?', a: 'AP for news and most blogs, Chicago for books and many publishers, APA for psychology and social sciences, MLA for humanities papers.' },
    ],
    example: {
      intro: 'One headline, two style guides. Chicago and MLA lowercase every preposition; AP and APA capitalize prepositions of four letters or more, so "From" and "With" change.',
      inputLabel: 'input',
      input: 'a guide to working from home with kids',
      outputLabel: 'Chicago · AP',
      output: 'A Guide to Working from Home with Kids\nA Guide to Working From Home With Kids',
    },
    mistakes: [
      { title: 'Capitalizing every word', body: 'That is Capitalized Case. Title case keeps short words like "of", "and" and "the" lowercase in the middle of a title.' },
      { title: 'Lowercasing the first or last word', body: 'Every style capitalizes the first and last word, even "a" or "up": "Where Are You From", not "from".' },
      { title: 'Lowercasing long prepositions in AP', body: 'AP and APA capitalize any word of four letters or more, so "Between", "Through" and "With" are capitalized there.' },
      { title: 'Forgetting the word after a colon', body: 'The first word after a colon starts a subtitle and is capitalized: "The End: A Story", not "The End: a Story".' },
      { title: 'Changing brand names and acronyms', body: 'iPhone, eBay and NASA keep their own capitals. The converter leaves words with inner capitals and all-caps words alone.' },
    ],
    related: ['case-converter', 'slug-generator', 'word-counter'],
  },
  'word-counter': {
    h1: 'Word counter',
    lede: 'Count words and characters as you type: characters with and without spaces, sentences, paragraphs, and reading and speaking time. Set a character limit, such as 280 for a post or 160 for a text message, to see how many characters you have left.',
    steps: [
      { title: 'Type or paste', body: 'Counts update on every keystroke, even for very long documents. You can also open or drop a text file.' },
      { title: 'Set a character limit', body: 'Pick 160, 280, 500 or 1,000, or type your own. A bar shows how much is used and how many characters are left or over.' },
      { title: 'Copy the stats', body: 'Copy every count as plain text for a report or a brief. The top-words list (common words like "the" left out) shows what you repeat.' },
    ],
    faq: [
      { q: 'How are words counted?', a: 'A word is a run of letters or digits, which may include apostrophes and hyphens: "don’t" and "well-known" are one word each. Numbers count as words, like in Word and Google Docs.' },
      { q: 'Are spaces counted as characters?', a: 'In “Characters”, yes: every space, line break and punctuation mark counts. “Without spaces” leaves out spaces, tabs and line breaks. Forms and essay limits usually mean characters with spaces.' },
      { q: 'Do emoji count as one character?', a: 'Yes. Characters are counted as you see them, so an emoji or an accented letter counts once.' },
      { q: 'Does it count the same way as X (Twitter)?', a: 'Not exactly. X counts every link as 23 characters, and counts emoji and Chinese, Japanese and Korean characters as two each. This counter counts each character once, so treat the 280 limit as a close guide.' },
      { q: 'Why does a text message split before 160 characters?', a: 'One SMS holds 160 characters only when every character is in the basic GSM alphabet. A single emoji or certain accented letters switch the whole message to a format that holds 70.' },
      { q: 'How is reading time worked out?', a: 'At 238 words a minute, the average adult silent reading speed found by a large 2019 review; speaking time uses 150 words a minute.' },
      { q: 'Is my text saved or uploaded?', a: 'It’s never uploaded. It is kept in this browser so it’s still here when you come back; “Forget input” clears it.' },
    ],
    sources: [
      { title: 'How many words do we read per minute? (Brysbaert, 2019)', url: 'https://doi.org/10.1016/j.jml.2019.104047', about: 'the review behind the 238 words a minute reading speed' },
      { title: 'Counting characters (X developer docs)', url: 'https://docs.x.com/fundamentals/counting-characters', about: 'how X counts links, emoji and CJK characters' },
    ],
    related: ['case-converter', 'title-case', 'line-cleaner', 'lorem-ipsum'],
  },
  'password-generator': {
    h1: 'Password generator',
    lede: 'Create strong, random passwords using your browser’s cryptographic random number generator. Choose the length and characters and see how strong the result is.',
    steps: [
      { title: 'Set length and characters', body: 'Longer is stronger: 16 or more characters with all four sets is a good default.' },
      { title: 'Check the strength', body: 'Entropy in bits and a rough time to crack it by brute force.' },
      { title: 'Copy it', body: 'Generate as many as you like. Passwords aren’t stored or sent anywhere.' },
    ],
    faq: [
      { q: 'Is it safe to generate passwords online?', a: 'This page creates them with crypto.getRandomValues in your browser, and the password never leaves your device. The page sends only cookieless usage counts (which page and tool, plus basic browser details), never your input. Microsoft Clarity also records clicks and scrolling to show how pages are used, with tool areas hidden. Store it in a password manager.' },
      { q: 'How long should a password be?', a: 'At least 15 characters when the password alone protects the account, which is the minimum in NIST’s current guidelines; 16 or more is a good default. Each extra character multiplies the work for an attacker far more than adding symbols does.' },
      { q: 'Is this a non-dictionary password generator?', a: 'It doesn’t use a word list. The tool picks each character at random from the sets you choose, rather than selecting words, so it is not a passphrase generator. Random characters can still spell a short word fragment by chance, so there is no guarantee that a result contains no dictionary word or pattern. The strength shown comes from length and the character sets used, not from avoiding words.' },
      { q: 'What does "exclude ambiguous characters" do?', a: 'Leaves out characters that look alike, such as I, l, 1, O and 0, which helps when a password has to be read or typed by hand.' },
    ],
    sources: [
      { title: 'NIST SP 800-63B: Authentication and Authenticator Management', url: 'https://pages.nist.gov/800-63-4/sp800-63b.html', about: 'current password guidance, including the 15-character minimum' },
      { title: 'Crypto.getRandomValues() on MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues', about: 'the browser’s cryptographic random number generator used here' },
    ],
    related: ['hash-generator', 'uuid-generator', 'qr-code'],
  },
  'lorem-ipsum': {
    h1: 'Lorem ipsum generator',
    lede: 'Generate lorem ipsum placeholder text by paragraphs, sentences or words, as plain text or HTML. Starts with the classic "Lorem ipsum dolor sit amet" if you like.',
    steps: [
      { title: 'Choose how much', body: 'A number of paragraphs, sentences or words.' },
      { title: 'Pick the format', body: 'Plain text, or HTML with each paragraph in <p> tags.' },
      { title: 'Copy it', body: 'Regenerate for different text; the length stays the same.' },
    ],
    faq: [
      { q: 'What is lorem ipsum?', a: 'Scrambled Latin, derived from Cicero’s "De finibus bonorum et malorum" (45 BC), used since the 1500s as placeholder text so a layout can be judged without readable content distracting from it.' },
      { q: 'Why not use real text?', a: 'Readable text draws attention to what it says. Lorem ipsum has a natural-looking spread of word lengths without meaning, so people focus on the design.' },
      { q: 'Is it free to use?', a: 'Yes. Lorem ipsum is public domain and so is everything this generator writes.' },
    ],
    example: {
      intro: 'Eight words, starting with the classic opening, as plain text.',
      inputLabel: 'settings',
      input: 'Words: 8\nStart with "Lorem ipsum": on\nHTML: off',
      outputLabel: 'output',
      output: 'Lorem ipsum dolor sit amet consectetur adipiscing elit',
    },
    mistakes: [
      { title: 'Shipping placeholder text', body: 'Lorem ipsum left in a live page looks broken. Search the build for "lorem" before every release.' },
      { title: 'Testing only with lorem ipsum', body: 'Real text has long words, numbers, links and other languages that break layouts in ways Latin filler never will. Test with real content too.' },
      { title: 'Using it where screen readers go', body: 'Screen readers read the Latin aloud. Keep placeholder text out of alt text, labels and anything assistive tech announces.' },
      { title: 'Pasting HTML into a text field', body: 'The HTML option wraps paragraphs in <p> tags; pasted into a plain text field, the tags show up as text. Use plain text there.' },
    ],
    related: ['word-counter', 'mock-json', 'line-cleaner', 'case-converter'],
  },
  'qr-code': {
    h1: 'QR code generator',
    lede: 'Make QR codes for links, text, Wi-Fi, email or phone numbers. Choose colors, size and error correction, then download a PNG or SVG. Free, with no sign-up and no expiry.',
    steps: [
      { title: 'Pick what to encode', body: 'A link or text, Wi-Fi details (so phones join with a scan), an email or a phone number.' },
      { title: 'Style it', body: 'Colors, size, quiet-zone margin and error correction. Keep strong contrast so every phone can scan it.' },
      { title: 'Download', body: 'SVG for print at any size, PNG for screens and documents.' },
    ],
    faq: [
      { q: 'Do these QR codes expire?', a: 'Never. The QR code contains your data directly, not a redirect through someone’s server, so it works for as long as the link or text inside it does.' },
      { q: 'Are scans tracked?', a: 'No. There is no short link or tracking server in between; a scan goes straight to what you encoded.' },
      { q: 'What is error correction?', a: 'Extra data that lets a scanner read a damaged or partly covered code: L recovers about 7%, M 15%, Q 25% and H 30%. Higher levels make the code denser.' },
      { q: 'Can I make a QR code that shares my Wi-Fi?', a: 'Yes. Choose Wi-Fi, enter the network name and password, pick the security type (WPA, WEP or none) and switch on Hidden if the network does not broadcast its name. The code uses the standard WIFI: format that Android and iPhone cameras (iOS 11 and later) can read before offering to join. Support can vary by scanner app and device, so scan it with a phone before you print it.' },
      { q: 'Is the Wi-Fi password visible in the QR code?', a: 'The password is stored in the code as plain text, so anyone who can scan it can read it. Share it only where you would share the password itself. Here it is not saved in your browser or put in share links.' },
      { q: 'What if my network name or password has special characters?', a: 'Backslashes, semicolons, colons, commas and quotes are escaped for you, as the format requires, so type them as you normally would.' },
      { q: 'How much can a QR code hold?', a: 'Up to about 2,900 bytes at level L: plenty for links and Wi-Fi details. Shorter content gives a simpler, easier-to-scan code.' },
    ],
    related: ['url-encoder', 'favicon-generator', 'image-resizer'],
  },
  'color-converter': {
    h1: 'Color converter',
    lede: 'Convert a color between HEX, RGB, HSL, HSV, OKLCH and CMYK, check its contrast against white and black, and get tints, shades and harmonious palettes.',
    steps: [
      { title: 'Enter or pick a color', body: 'Type any CSS color (#ff7f50, rgb(), hsl(), oklch() or a name like coral), or click “Pick a color” to choose one visually.' },
      { title: 'Copy any format', body: 'Every notation updates together, ready to paste into CSS or a design tool.' },
      { title: 'Build a palette', body: 'Tints and shades, plus complementary, analogous and triadic colors. Click any swatch to use it.' },
    ],
    faq: [
      { q: 'How do I convert HEX to RGB?', a: 'Split the six digits into pairs and read each as a hexadecimal number: #ff7f50 is ff = 255, 7f = 127, 50 = 80, so rgb(255 127 80). Paste it above to get every format at once.' },
      { q: 'Can I pick a color instead of typing one?', a: 'Yes. “Pick a color” opens your browser’s color picker; in Chrome and Edge on desktop it includes an eyedropper for sampling any color on your screen. The chosen color fills in every format.' },
      { q: 'What contrast ratio do I need?', a: 'WCAG asks for at least 4.5:1 for normal text (AA) and 3:1 for large text; 7:1 meets AAA. The ratios against white and black are shown for every color; the contrast checker tests any text and background pair.' },
      { q: 'What is OKLCH?', a: 'A modern CSS color space where equal steps in lightness look equal to the eye, which makes it better than HSL for building consistent palettes.' },
    ],
    related: ['color-palette', 'contrast-checker', 'css-gradient'],
  },
  'css-gradient': {
    h1: 'CSS gradient generator',
    lede: 'Design linear, radial and conic CSS gradients visually. Add color stops, drag positions, set the angle and copy the CSS. Works in every modern browser.',
    steps: [
      { title: 'Choose the type', body: 'Linear runs along an angle, radial spreads from the center, conic sweeps around it.' },
      { title: 'Edit the stops', body: 'Pick each color and its position; add or remove stops as you need.' },
      { title: 'Copy the CSS', body: 'A ready background property, previewed full size above.' },
    ],
    faq: [
      { q: 'Do CSS gradients need vendor prefixes?', a: 'No. linear-gradient, radial-gradient and conic-gradient work unprefixed in every current browser.' },
      { q: 'How do I make a hard color stop?', a: 'Give two stops the same position, such as red 50% and blue 50%, and the colors meet with a sharp edge instead of blending.' },
      { q: 'Is the gradient an image?', a: 'No, it is pure CSS, so it is sharp at any size and costs nothing to download.' },
    ],
    example: {
      intro: 'A left-to-right sunset fade: two stops, 90 degrees.',
      inputLabel: 'settings',
      input: 'Type: linear\nAngle: 90°\nStops: #ff7e5f at 0%, #feb47b at 100%',
      outputLabel: 'css',
      output: 'background: linear-gradient(90deg, #ff7e5f 0%, #feb47b 100%);',
    },
    mistakes: [
      { title: 'Using background-color', body: 'A gradient is an image, so background-color ignores it. Use background or background-image.' },
      { title: 'Getting the angle backwards', body: '0deg runs bottom to top and 90deg left to right; angles turn clockwise. "to right" is the same as 90deg.' },
      { title: 'Expecting a hard edge', body: 'Colors blend between stops. For a sharp line, give two stops the same position: red 50%, blue 50%.' },
      { title: 'Oval radial gradients', body: 'radial-gradient is an ellipse that follows the box shape unless you say circle.' },
    ],
    related: ['color-palette', 'contrast-checker', 'color-converter'],
  },
  'code-beautifier': {
    h1: 'Code beautifier',
    lede: 'Format messy or minified code in Python, Java, C, C++, C#, Go, PHP, JavaScript, TypeScript, Lua and Shell, plus SQL, HTML, CSS, JSON, XML and YAML. Each language uses its own standard formatter, and CSS, HTML, JSON and XML can be minified too.',
    steps: [
      { title: 'Paste your code', body: 'The language is detected automatically; pick it from the list if the guess is wrong.' },
      { title: 'Set the style', body: '“Default” follows each language’s convention (4 spaces for Python and Java, tabs for Go); or choose 2 spaces, 4 spaces or tabs, and the line width. For CSS, HTML, JSON and XML, switch to Minify for a compact copy.' },
      { title: 'Copy or download', body: 'The formatted code updates as you type. Syntax errors are reported instead of breaking your code.' },
    ],
    faq: [
      { q: 'Which formatters are used?', a: 'The standard one for each language: Ruff (Black-compatible) for Python, clang-format for C, C++, Java and C#, gofmt for Go, Mago for PHP, StyLua for Lua, shfmt for shell scripts, Prettier for JavaScript, TypeScript, HTML, CSS, YAML and Markdown, and sql-formatter for SQL. JSON goes through the site’s JSON formatter, which keeps numbers exactly as written. XML is checked for well-formedness and re-indented by a small built-in formatter that only changes whitespace between tags.' },
      { q: 'Is it the same as running the formatter locally?', a: 'For the formatters above, yes: Prettier runs as JavaScript and the others are compiled to WebAssembly, so the output matches what you get on your machine with the same settings.' },
      { q: 'Which languages can be minified?', a: 'CSS, HTML, JSON and XML. Minifying removes comments and whitespace that don’t matter and leaves everything else as written. JavaScript isn’t minified here: doing that safely takes a dedicated minifier such as Terser.' },
      { q: 'What about Rust, Kotlin, Swift or Ruby?', a: 'Their formatters can’t run in a browser yet. They’ll be added as browser builds become available.' },
      { q: 'Is my code uploaded?', a: 'No. Formatting happens in this tab, so it’s safe for private and proprietary code.' },
    ],
    related: ['python-formatter', 'java-beautifier', 'sql-formatter', 'json-formatter'],
  },
  'markdown-preview': {
    h1: 'Markdown preview',
    lede: 'A Markdown editor with live preview: write Markdown and see it rendered as you type, GitHub-flavored, with tables, task lists, code blocks and links. Save your work as a .md file or a standalone HTML page. Everything stays in your browser.',
    steps: [
      { title: 'Write or open Markdown', body: 'Start typing, paste a README, or open or drop a .md file. The preview updates as you type.' },
      { title: 'Check the result', body: 'GitHub-flavored Markdown: tables, task lists, strikethrough and fenced code all render as they would on GitHub.' },
      { title: 'Save or export', body: 'Copy or download the Markdown itself, copy the rendered HTML, or download a standalone HTML page titled after your first heading.' },
    ],
    faq: [
      { q: 'Can I use it as an online Markdown editor?', a: 'Yes. Your text is kept in this browser, so a draft is still here when you come back, and “Share” puts it in a link. Download it as a .md file to keep a copy; “Forget input” clears it.' },
      { q: 'Which Markdown flavor is supported?', a: 'GitHub-flavored Markdown (GFM): CommonMark plus tables, task lists, strikethrough and autolinks.' },
      { q: 'What is in the downloaded HTML page?', a: 'A complete document with your rendered Markdown, a title taken from the first heading and a little built-in styling for readable text, code and tables. It needs no other files, so you can open it anywhere or attach it to an email.' },
      { q: 'Is the preview safe with untrusted Markdown?', a: 'Yes. The HTML is sanitized before display and before export, so scripts and event handlers in the Markdown can’t run.' },
      { q: 'Why don’t images from other sites show?', a: 'The page blocks images from other sites, so nothing in your Markdown can make a request to them. They appear normally in the exported HTML.' },
    ],
    example: {
      intro: 'Release notes with a task list and inline code, and the HTML it turns into.',
      inputLabel: 'markdown',
      input: '## Release notes\n\n- [x] Faster startup\n- [ ] Dark mode\n\nRun `npm run build` to **ship** it.\n',
      outputLabel: 'html',
      output:
        '<h2>Release notes</h2>\n<ul>\n<li><input checked="" disabled="" type="checkbox"> Faster startup</li>\n<li><input disabled="" type="checkbox"> Dark mode</li>\n</ul>\n<p>Run <code>npm run build</code> to <strong>ship</strong> it.</p>\n',
    },
    mistakes: [
      { title: 'Expecting a newline to break the line', body: 'A single newline joins lines into one paragraph. End a line with two spaces or a backslash, or leave a blank line.' },
      { title: 'No blank line after a list', body: 'Text right under a list item, without a blank line, becomes part of that item.' },
      { title: 'Tables without the separator row', body: 'A table needs the | --- | line under the header; without it the pipes show as plain text.' },
      { title: 'Under-indented nested lists', body: 'Nested items must line up with the parent item’s text: 2 spaces under "- ", 3 under "1. ".' },
    ],
    related: ['html-entities', 'html-beautifier', 'word-counter'],
  },
};
