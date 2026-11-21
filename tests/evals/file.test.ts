import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { heroSampleMessages } from "@/lib/scenarios/hero";
import { categories, isScoredRow, readJsonl } from "@/scripts/eval-data";
import { convertTsv } from "@/scripts/eval-rows";

const source = readFileSync("evals/messages.th.tsv", "utf8");
const records = readJsonl(readFileSync("evals/messages.th.jsonl", "utf8"));
const rows = records.filter(isScoredRow);

it("validates all JSONL records and matches the mechanical conversion of the tracked TSV", () => {
  expect(records).toEqual(convertTsv(source));
  expect(records.some(row => row.id === "_rules")).toBe(true);
  expect(new Set(records.map(row => row.id)).size).toBe(records.length);
  for (const row of rows) {
    if (row.expected.evidence_quote !== null) expect(row.text).toContain(row.expected.evidence_quote);
  }
});

it("retains the three original messages and their labels when the starter corpus is used", () => {
  const starter = rows.filter(row => row.id.startsWith("starter-hero-"));
  if (!starter.length) return;
  expect(starter).toHaveLength(3);
  for (const [index, sample] of heroSampleMessages.entries()) {
    const { warehouse, skus, window_start, window_end, kind, evidence_quote, clarify_about } = sample.expected;
    expect(starter.find(row => row.id === `starter-hero-${index + 1}`)).toMatchObject({
      scenario: "hero", text: sample.text, category: ["clear", "ambiguous", "irrelevant"][index], expected: {
        kind, warehouse, skus: skus.length ? skus : null, start: window_start, end: window_end, evidence_quote, clarify_about,
      },
    });
  }
});

it("reports the actual counts and requires both splits; the strict human-corpus check requires every category", () => {
  const counts = Object.fromEntries(categories.map(category => [category, rows.filter(row => row.category === category).length]));
  const dev = rows.filter(row => row.split === "dev").length;
  const heldout = rows.filter(row => row.split === "heldout").length;
  process.stdout.write(`Thai evaluation corpus: dev=${dev}, heldout=${heldout}, categories=${JSON.stringify(counts)}\n`);
  expect(dev).toBeGreaterThan(0);
  expect(heldout).toBeGreaterThan(0);
  if (process.env.EVAL_REQUIRE_FULL_CORPUS === "1") {
    const missing = categories.filter(category => counts[category] === 0);
    expect(missing, "Missing required human-corpus categories: " + missing.join(", ")).toEqual([]);
  }
});
