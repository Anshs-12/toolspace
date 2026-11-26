import JsonToCsv from './JsonToCsv';

/** Same converter, opened on the CSV → JSON side so this page starts on the task it is named for. */
export default function CsvToJson() {
  return <JsonToCsv defaultDirection="csv-json" />;
}
