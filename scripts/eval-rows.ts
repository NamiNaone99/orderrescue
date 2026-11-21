import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CsvError, parse } from "csv-parse/sync";
import { checkEntry, type Entry } from "./eval-data";

const required = ["id", "split", "category", "text", "kind", "warehouse", "skus", "start", "end", "evidence_quote", "clarify_about", "author", "checked_by"];

export function convertTsv(input: string): Entry[] {
  let entries: { record: string[]; info: { lines: number } }[];
  try {
    // info.lines is the physical ending line, including newlines in spreadsheet-quoted cells.
    entries = parse(input, { delimiter: "\t", bom: true, info: true, columns: false }) as unknown as typeof entries;
  } catch (error) {
    if (error instanceof CsvError) throw new Error(`Line ${error.lines}: ${error.code}`);
    throw error;
  }
  const header = entries.shift()?.record ?? [];
  if (required.some(field => !header.includes(field)) || new Set(header).size !== header.length
    || header.some(field => !required.includes(field) && field !== "scenario")) {
    throw new Error("Line 1: expected the DATA_PLAN §6 column names, with optional scenario");
  }
  const ids = new Set<string>();
  return entries.map(({ record, info }) => {
    const cell = Object.fromEntries(header.map((name, index) => [name, record[index] === "" ? null : record[index]]));
    return checkEntry({
      id: cell.id, split: cell.split, scenario: "scenario" in cell ? cell.scenario : "real-day",
      category: cell.category, text: cell.text, expected: {
        kind: cell.kind, warehouse: cell.warehouse, skus: cell.skus?.split(",") ?? null,
        start: cell.start, end: cell.end, evidence_quote: cell.evidence_quote, clarify_about: cell.clarify_about,
      }, author: cell.author, checked_by: cell.checked_by, synthetic: true,
    }, info.lines, ids);
  });
}

async function main() {
  const file = "evals/messages.th.jsonl";
  const rows = convertTsv(await readFile("evals/messages.th.tsv", "utf8"));
  const temporary = file + "." + randomUUID() + ".tmp";
  try {
    await writeFile(temporary, rows.map(row => JSON.stringify(row)).join("\n") + "\n", "utf8");
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
  console.log(`Wrote ${rows.length} records to ${file}`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve("scripts/eval-rows.ts")) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
