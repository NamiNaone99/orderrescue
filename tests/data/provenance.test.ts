import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { loadProvenance } from "@/lib/provenance";

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "orderrescue-provenance-")); });
afterEach(() => {
  if (dirname(resolve(root)) !== resolve(tmpdir()) || !basename(root).startsWith("orderrescue-provenance-")) throw new Error("Unexpected fixture path");
  rmSync(root, { recursive: true });
});

it("omits the dataset, message count and evaluation in an empty checkout", () => {
  expect(loadProvenance(root)).toEqual({ provenance: undefined, messageCount: undefined, evaluation: undefined });
});

it("counts synthetic examples and selects the newest result by UTC filename", () => {
  const folder = join(root, "evals/results");
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(root, "evals/messages.th.jsonl"), [
    { id: "_rules", synthetic: true }, { id: "example", synthetic: true },
  ].map(row => JSON.stringify(row)).join("\n"));
  const latest = { timestamp: "2026-11-21T05:10:01.001Z", interpreter: "offline", counts: { scored: 1 } };
  writeFileSync(join(folder, "2026-11-21T05-10-01.001Z-offline-all.json"), JSON.stringify(latest));
  writeFileSync(join(folder, "2026-11-21T04-10-01.001Z-offline-all.json"), JSON.stringify({ counts: { scored: 0 } }));
  expect(loadProvenance(root)).toEqual({ provenance: undefined, messageCount: 1, evaluation: latest });
});
