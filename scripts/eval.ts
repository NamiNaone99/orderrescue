import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";
import { interpret, type InterpreterClient } from "@/lib/interpreter";
import { getInterpreterRuntime } from "@/lib/interpreter/runtime";
import { scenarioRegistry } from "@/lib/scenarios";
import { categories, isScoredRow, readJsonl, type EvalRow } from "./eval-data";
import { meetsThresholds, score, summarize, type RunRow } from "./eval-score";

export function options(args: string[]) {
  const { values } = parseArgs({ args, options: { live: { type: "boolean", default: false },
    split: { type: "string", default: "all" }, limit: { type: "string" } } });
  const { split, live, limit } = values;
  if (split !== "dev" && split !== "heldout" && split !== "all") throw new Error("--split must be dev, heldout or all");
  if (limit !== undefined && (!/^[1-9]\d*$/.test(limit) || !Number.isSafeInteger(Number(limit)))) {
    throw new Error("--limit must be a positive integer");
  }
  return { live, split, limit: limit === undefined ? undefined : Number(limit) };
}

const scenarios = new Map(Object.entries(scenarioRegistry));

export async function runRows(rows: EvalRow[], clients: readonly InterpreterClient[], delayMs = 0) {
  const results: RunRow[] = [];
  let attempted = false;
  for (const row of rows) {
    const entry = scenarios.get(row.scenario);
    if (!entry) {
      const { id, category, expected, scenario, split } = row;
      results.push({ id, category, expected, scenario, split, status: "skipped", reason: "unregistered_scenario" });
      continue;
    }
    if (attempted && delayMs > 0) await sleep(delayMs);
    attempted = true;
    const actual = await interpret(row.text, entry.snapshot, { clients });
    results.push(score(row, actual, entry.snapshot.scenario.now_at.slice(0, 10)));
  }
  const byCategory = Object.fromEntries(categories.map(category => [category, summarize(results.filter(row => row.category === category))]));
  return { counts: summarize(results), by_category: byCategory, rows: results };
}

type Batch = Awaited<ReturnType<typeof runRows>>;

export function gate(flags: ReturnType<typeof options>, batch: Batch, corpus: EvalRow[]) {
  const { counts } = batch;
  const liveHeldout = flags.live && flags.split === "heldout";
  const heldout = corpus.filter(row => row.split === "heldout");
  const full = liveHeldout && counts.skipped === 0 && counts.scored >= 30 && counts.incident_fields.total > 0
    && counts.selected === heldout.length
    && heldout.every(row => row.author !== null && row.checked_by !== null)
    && categories.every(category => corpus.some(row => row.category === category));
  const thresholds = meetsThresholds(counts);
  return {
    ac26: full ? (thresholds ? "passed" : "failed") : "unverified",
    exit_code: counts.skipped > 0 || (liveHeldout && !thresholds) ? 1 : 0,
  };
}

function printBatch(mode: string, batch: Batch) {
  const fraction = (value: { correct: number; total: number }) => `${value.correct}/${value.total}`;
  for (const [group, c] of Object.entries({ overall: batch.counts, ...batch.by_category })) {
    console.log([mode, group, c.scored, c.skipped, fraction(c.kind), fraction(c.warehouse), fraction(c.skus),
      fraction(c.window), fraction(c.evidence), fraction(c.incident_fields), fraction(c.clarify_about),
      c.false_incidents, c.latency_ms.p50 ?? "—", c.latency_ms.p95 ?? "—", JSON.stringify(c.answered)].join("\t"));
  }
  const failingIds = batch.rows.filter(row => row.status === "scored" && !row.passed).map(row => row.id);
  console.log(`Failing ids (${mode}): ${failingIds.join(", ") || "none"}`);
  for (const row of batch.rows) {
    if (row.status === "skipped") console.log(`Skipped ${row.id}: ${row.reason} (${row.scenario})`);
    else if (!row.passed) console.log(`Failed ${row.id}: expected=${JSON.stringify(row.expected)} actual=${JSON.stringify(row.actual)}`);
  }
}

async function main() {
  const flags = options(process.argv.slice(2));
  const input = await readFile("evals/messages.th.jsonl", "utf8");
  const corpus = readJsonl(input).filter(isScoredRow);
  const selection = corpus.filter(row => flags.split === "all" || row.split === flags.split).slice(0, flags.limit);
  if (!selection.length) throw new Error("No evaluation rows in the selected split");
  const mode = flags.live ? "live" : "offline";
  let clients: readonly InterpreterClient[] = [];
  if (flags.live) {
    process.env.INTERPRETER_MODE = "openai";
    clients = getInterpreterRuntime().clients;
    if (!clients.length) throw new Error("Live evaluation requires a configured OpenAI key and live interpreter");
    const runnable = selection.filter(row => scenarios.has(row.scenario)).length;
    console.log(`Estimated API calls: ${runnable}–${runnable * Math.min(2, clients.length)} for ${runnable} registered rows, sequentially.`);
  }
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const timestamp = new Date().toISOString();
  const batch = await runRows(selection, clients, flags.live ? 250 : 0);
  const baseline = flags.live ? await runRows(selection, []) : undefined;
  console.log("Mode\tGroup\tScored\tSkipped\tKind\tWarehouse\tSKU set\tWindow\tEvidence\tIncident fields\tClarify about\tFalse incidents\tp50 ms\tp95 ms\tAnswered by");
  if (baseline) printBatch("offline", baseline);
  printBatch(mode, batch);
  const { ac26, exit_code } = gate(flags, batch, corpus);
  const report = {
    timestamp, commit, corpus_sha256: createHash("sha256").update(input).digest("hex"), interpreter: mode, models: clients.map(client => client.name.slice("openai:".length)),
    split: flags.split, limit: flags.limit ?? null, ac26, ...batch, offline_comparison: baseline,
  };
  await mkdir("evals/results", { recursive: true });
  const path = `evals/results/${timestamp.replace(/:/g, "-")}-${mode}-${flags.split}.json`;
  await writeFile(path, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(`AC-26: ${ac26}. Report: ${path}`);
  process.exitCode = exit_code;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve("scripts/eval.ts")) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
