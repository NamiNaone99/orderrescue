import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const repository = "https://github.com/NamiNaone99/orderrescue";
export const source = (path: string) => repository + "/blob/main/" + path;
export const directory = (path: string) => repository + "/tree/main/" + path;
export const correctionsHeading = "What Codex got wrong and how we caught it";

export interface LogRow {
  time: string;
  task: string;
  who: string;
  surface: string;
  model: string;
  summary: string;
  outcome: string;
  corrections: string;
  logHref?: string;
}

function cells(line: string): string[] {
  return line.trim().slice(1, -1).split(/(?<!\\)\|/).map(value => value.trim().replaceAll("\\|", "|"));
}

function section(text: string, heading: string): string[] {
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex(line => line.trim() === "## " + heading);
  if (index === -1) return [];
  const body = lines.slice(index + 1);
  const next = body.findIndex(line => /^#{1,2}\s/.test(line));
  return next < 0 ? body : body.slice(0, next);
}

export function readTimeline(markdown: string): LogRow[] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex(line => /^\|\s*Time\s*\|\s*Task\s*\|/.test(line));
  if (start === -1) return [];
  const rows: LogRow[] = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.trim().startsWith("|")) break;
    const columns = cells(line);
    if (columns.length !== 12 || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(columns[0])) continue;
    const [time, task, who, surface, model, summary, outcome, , , , corrections] = columns;
    rows.push({ time, task, who, surface, model, summary, outcome, corrections });
  }
  return rows.sort((a, b) => a.time.localeCompare(b.time));
}

export function summarize(rows: LogRow[]) {
  const tasks = new Set(rows.map(row => row.task).filter(task => /^T\d+[a-z]?$/.test(task)));
  const pulls = new Set<string>();
  const fixes = new Set<string>();
  for (const { outcome } of rows) {
    for (const match of outcome.matchAll(/\]\(https:\/\/github\.com\/NamiNaone99\/orderrescue\/pull\/(\d+)\)/g)) pulls.add(match[1]);
    for (const match of outcome.matchAll(/\[Closed (F\d+)\]\(codex-log\/[\w-]+\.md\)/g)) fixes.add(match[1]);
  }
  return { tasks: tasks.size, pulls: pulls.size, fixes: fixes.size };
}

export function parseBuildEvidence(ledger: string, tasks: string) {
  const rows = readTimeline(ledger);
  const corrections: string[] = [];
  for (const line of section(ledger, correctionsHeading)) {
    const entry = /^[-*]\s+(\S.*)$/.exec(line);
    if (entry) corrections.push(entry[1].trim());
    else if (corrections.length && /^\s{2,}\S/.test(line)) corrections[corrections.length - 1] += " " + line.trim();
  }
  const heading = tasks.match(/^## (T03 [^\r\n]+)/m)?.[1];
  const promptBlock = heading ? section(tasks, heading).join("\n") : "";
  const prompt = promptBlock.match(/^```[^\n]*\n([\s\S]*?)\n```/m)?.[1];
  return { rows, corrections, prompt, counts: summarize(rows) };
}

export function loadBuildEvidence(root = process.cwd()) {
  function read(name: string) {
    const path = join(root, "docs", name);
    return existsSync(path) ? readFileSync(path, "utf8") : "";
  }
  const evidence = parseBuildEvidence(read("CODEX_LOG.md"), read("CODEX_TASKS.md"));
  for (const row of evidence.rows) {
    if (/^T\d+[a-z]?$/.test(row.task)) {
      const path = "docs/codex-log/" + row.task + ".md";
      if (existsSync(join(root, path))) row.logHref = source(path);
    }
  }
  const reviewRow = read("codex-log/T03.md").split(/\r?\n/).find(line => line.startsWith("| `codex review --uncommitted` |"));
  return { ...evidence, plannerReview: reviewRow ? cells(reviewRow)[1] : undefined };
}
