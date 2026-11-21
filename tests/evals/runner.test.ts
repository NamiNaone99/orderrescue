import { heroSampleMessages } from "@/lib/scenarios/hero";
import { afterEach, expect, it, vi } from "vitest";
import type { InterpretResponse } from "@/lib/domain/contracts";
import { gate, options, runRows } from "@/scripts/eval";
import { isScoredRow, readJsonl } from "@/scripts/eval-data";
import { convertTsv } from "@/scripts/eval-rows";
import { checkAnswer, meetsThresholds, score, summarize } from "@/scripts/eval-score";

const headers = "id\tsplit\tcategory\ttext\tkind\twarehouse\tskus\tstart\tend\tevidence_quote\tclarify_about\tauthor\tchecked_by";
const source = [headers + "\tscenario", ...heroSampleMessages.map(({ text, expected }, i) => [
  `starter-hero-${i+1}`, i === 1 ? "heldout" : "dev", ["clear", "ambiguous", "irrelevant"][i], text,
  expected.kind, expected.warehouse, expected.skus.join(","), expected.window_start, expected.window_end,
  expected.evidence_quote, expected.clarify_about, "", "", "hero",
].join("\t"))].join("\n");
const seed = (text: string) => convertTsv(headers + "\n" + text + "\n");
const converterExample = ["starter-hero-1", "dev", "clear", '  "quoted"\tSKU-X,SKU-Y ', "incident", "A", "SKU-X,SKU-Y",
  "13:00", "18:00", "SKU-X", "", "", ""];

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("preserves literal cell content including quoted tabs and quotes, splits SKU cells, and defaults the scenario", () => {
  const cells = converterExample.map(value => '"' + value.replaceAll('"', '""') + '"');
  expect(seed(cells.join("\t"))[0]).toMatchObject({
    text: converterExample[3], scenario: "real-day", expected: { skus: ["SKU-X", "SKU-Y"], clarify_about: null },
  });
});

it("identifies malformed TSV and JSONL line numbers, duplicate ids and non-verbatim evidence", () => {
  expect(() => convertTsv("id\n_rules")).toThrow(/Line 1/);
  expect(() => seed("short")).toThrow(/Line 2/);
  const record = JSON.stringify(convertTsv(source).find(isScoredRow));
  expect(() => readJsonl(record + "\n" + record)).toThrow(/Line 2: duplicate id/);
  expect(() => readJsonl(record + "\n{")).toThrow(/Line 2: invalid JSON/);
  const value = JSON.parse(record);
  expect(() => readJsonl(JSON.stringify({ ...value, expected: { ...value.expected, evidence_quote: "absent evidence" } })))
    .toThrow(/Line 1: expected.evidence_quote/);
});

it("validates CLI switches and limits before interpreting", () => {
  expect(options([])).toEqual({ live: false, split: "all", limit: undefined });
  expect(options(["--split", "heldout", "--limit", "3"])).toEqual({ live: false, split: "heldout", limit: 3 });
  for (const args of [["--split", "test"], ["--limit", "0"], ["--limit", "1.2"], ["--unknown"]]) {
    expect(() => options(args)).toThrow();
  }
});

it("prevents network use in offline mode and explicitly counts unknown scenarios as skipped", async () => {
  const fetch = vi.fn(() => { throw new Error("Unexpected network call"); });
  vi.stubGlobal("fetch", fetch);
  vi.stubEnv("INTERPRETER_MODE", "openai");
  vi.stubEnv("OPENAI_API_KEY", "inert");
  const [row] = convertTsv(source).filter(isScoredRow);
  const batch = await runRows([row, { ...row, scenario: "unregistered" }], []);
  expect(batch.counts).toMatchObject({ selected: 2, scored: 1, skipped: 1, answered: { offline: 1 } });
  expect(batch.rows[1]).toMatchObject({ status: "skipped", reason: "unregistered_scenario" });
  expect(gate(options([]), batch, [row])).toEqual({ ac26: "unverified", exit_code: 1 });
  expect(fetch).not.toHaveBeenCalled();
});

it("scores exact SKU sets, the full dated window and verbatim evidence while counting wrong kinds as field misses", async () => {
  const [row] = convertTsv(source).filter(isScoredRow);
  const result = (await runRows([row], [])).rows[0];
  if (result.status !== "scored" || result.actual.outcome !== "incident") throw new Error("Expected an incident fixture");
  const actual = result.actual;
  const date = actual.incident.window_start.slice(0, 10);
  const shortQuote = actual.incident.evidence_quote.slice(0, 2);
  const changed = {
    ...actual, incident: { ...actual.incident, evidence_quote: shortQuote, sku_ids: [...actual.incident.sku_ids, ...actual.incident.sku_ids] },
  };
  expect(checkAnswer(row, changed, date)).toMatchObject({ kind: true, incident_fields: true, evidence: true });
  expect(checkAnswer(row, { ...actual, incident: { ...actual.incident, warehouse_id: "C", sku_ids: ["OTHER"], evidence_quote: "unsubmitted" } }, "2025-01-01"))
    .toMatchObject({ warehouse: false, skus: false, window: false, evidence: false, incident_fields: false });
  const ignored: InterpretResponse = { ...actual, outcome: "ignore", incident: null, clarification: null };
  expect(checkAnswer(row, ignored, date)).toMatchObject({ kind: false, incident_fields: false });
  const negative = convertTsv(source).filter(isScoredRow).find(item => item.expected.kind === "ignore");
  if (!negative) throw new Error("Expected an ignore fixture");
  expect(checkAnswer(negative, actual, date)).toMatchObject({ false_incident: true, incident_fields: null });
  const timed = [5, 10, 30].map(latency_ms => score(row, { ...actual, interpreter: { ...actual.interpreter, latency_ms } }, date));
  expect(summarize(timed).latency_ms).toEqual({ p50: 10, p95: 30 });
});

it("enforces the 90% and 80% boundaries, zero false incidents and the full-run qualification", async () => {
  const counts = { ...summarize([]), kind: { correct: 27, total: 30 }, incident_fields: { correct: 4, total: 5 } };
  expect(meetsThresholds(counts)).toBe(true);
  expect(meetsThresholds({ ...counts, false_incidents: 1 })).toBe(false);
  expect(meetsThresholds({ ...counts, kind: { correct: 26, total: 30 } })).toBe(false);
  expect(meetsThresholds({ ...counts, incident_fields: { correct: 3, total: 5 } })).toBe(false);
  const corpus = convertTsv(source).filter(isScoredRow);
  const batch = await runRows(corpus, []);
  expect(gate(options([]), batch, corpus).ac26).toBe("unverified");
  const flags = { live: true, split: "heldout" as const, limit: undefined };
  const smallHeldout = await runRows(corpus.filter(row => row.split === "heldout"), []);
  expect(gate(flags, smallHeldout, corpus)).toEqual({ ac26: "unverified", exit_code: 0 });
  expect(gate(flags, { ...batch, counts: { ...batch.counts, false_incidents: 1 } }, corpus))
    .toEqual({ ac26: "unverified", exit_code: 1 });
});
