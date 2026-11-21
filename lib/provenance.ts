import "server-only";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { CopyEntry } from "@/lib/copy";

const count = z.int().nonnegative();
const fieldKind = z.enum(["real", "real_shifted", "opaque", "simulated", "synthetic"]);
const configValue = z.union([z.number(), z.string(), z.array(z.union([z.number(), z.string()]))]);
const https = z.url({ protocol: /^https$/ });
const provenance = z.object({
  source_name: z.string(), source_url: https, licence: z.string(), licence_url: https, citation: z.string(),
  slice_date: z.iso.date(), demo_date: z.iso.date(), source_file_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  seed: count, row_counts: z.record(z.string(), count), fields: z.record(z.string(), fieldKind),
  config: z.record(z.string(), configValue),
}).partial();
const score = z.object({ correct: count, total: count });
const metrics = { kind: score, warehouse: score, skus: score, window: score, evidence: score, incident_fields: score, clarify_about: score };
const evaluation = z.object({
  timestamp: z.iso.datetime(), interpreter: z.string(), split: z.string(), models: z.array(z.string()),
  counts: z.object({ selected: count, scored: count, skipped: count, false_incidents: count, ...metrics }).partial(),
}).partial();
const message = z.object({ id: z.string(), synthetic: z.boolean().optional() });

export type FieldKind = z.infer<typeof fieldKind>;
export type Provenance = z.infer<typeof provenance>;
export type Evaluation = z.infer<typeof evaluation>;

const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 3 });
const percent = new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 2 });

export function fill(template: CopyEntry, values: Record<string, string | undefined>): CopyEntry | undefined {
  if ([...template.en.matchAll(/\{(\w+)\}/g)].some(([, key]) => values[key] === undefined)) return;
  const replace = (text: string) => text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
  return { th: replace(template.th), en: replace(template.en) };
}

export function parameters(p: Provenance) {
  const values: Record<string, string | undefined> = { demo_date: p.demo_date, slice_date: p.slice_date };
  for (const [key, value] of Object.entries(p.config ?? {})) {
    const formatter = ["shares", "share_jitter", "max_alternate_committed_fraction"].includes(key) ? percent : number;
    values[key] = (Array.isArray(value) ? value : [value]).map(item => typeof item === "number" ? formatter.format(item) : item).join(" / ");
  }
  return values;
}

function optional<T>(read: () => T): T | undefined {
  try { return read(); } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
}

export function loadProvenance(root = process.cwd()) {
  const derived = optional(() => readFileSync(join(root, "data/derived/day-2011-11-22.json"), "utf8"));
  const messages = optional(() => readFileSync(join(root, "evals/messages.th.jsonl"), "utf8"));
  const directory = join(root, "evals/results");
  const files = optional(() => readdirSync(directory, { withFileTypes: true })) ?? [];
  // T12 prefixes each filename with a sortable UTC timestamp. Filesystem mtimes change on checkout.
  const newest = files.filter(file => file.isFile() && file.name.endsWith(".json")).map(file => file.name).sort().at(-1);
  return {
    provenance: derived === undefined ? undefined : z.object({ provenance }).parse(JSON.parse(derived)).provenance,
    messageCount: messages === undefined ? undefined : messages.split(/\r?\n/).filter(line => line.trim()).filter(line => {
      const row = message.parse(JSON.parse(line));
      return !row.id.startsWith("_") && row.synthetic === true;
    }).length,
    evaluation: newest === undefined ? undefined : evaluation.parse(JSON.parse(readFileSync(join(directory, newest), "utf8"))),
  };
}
