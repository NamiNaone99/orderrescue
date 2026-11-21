import { z } from "zod";

export const categories = [
  "clear", "ambiguous", "contradictory", "irrelevant", "typo or slang", "multi-SKU",
  "out of scope or injected instruction",
] as const;
const text = z.string().min(1);
const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const member = z.enum(["P1", "P2", "P3"]);
const expected = z.strictObject({
  kind: z.enum(["incident", "clarification", "ignore"]),
  warehouse: text.nullable(), skus: z.array(text).nullable(),
  start: clock.nullable(), end: clock.nullable(), evidence_quote: text.nullable(),
  clarify_about: z.enum(["warehouse", "sku", "time", "conflict"]).nullable(),
});

export const rowSchema = z.strictObject({
  id: text.regex(/^[^_]/), split: z.enum(["dev", "heldout"]), scenario: text,
  text: text.refine(value => value.trim().length > 0 && value.trim().length <= 500),
  category: z.enum(categories), expected, author: member.nullable(), checked_by: member.nullable(),
  synthetic: z.literal(true),
}).superRefine((row, ctx) => {
  const { kind, warehouse, skus, start, end, evidence_quote } = row.expected;
  if (kind === "incident" && (!warehouse || !skus?.length || !start || !end || start >= end)) {
    ctx.addIssue({ code: "custom", path: ["expected"], message: "An incident requires warehouse, SKUs and an ordered window" });
  }
  if (evidence_quote !== null && !row.text.includes(evidence_quote)) {
    ctx.addIssue({ code: "custom", path: ["expected", "evidence_quote"], message: "Evidence must occur verbatim in the message" });
  }
  const starter = /^starter-hero-[123]$/.test(row.id);
  if (!starter && (!row.author || !row.checked_by || row.author === row.checked_by)) {
    ctx.addIssue({ code: "custom", path: ["checked_by"], message: "Human rows need an author and a second team member as checker" });
  }
});

export type EvalRow = z.infer<typeof rowSchema>;
export type Expected = EvalRow["expected"];
const commentSchema = z.looseObject({ id: text.regex(/^_/), text: z.string().nullable(), synthetic: z.literal(true) });
export type Entry = EvalRow | z.infer<typeof commentSchema>;

export function isScoredRow(entry: Entry): entry is EvalRow {
  return !entry.id.startsWith("_");
}

export function checkEntry(value: unknown, line: number, ids: Set<string>): Entry {
  const isComment = typeof value === "object" && value !== null && "id" in value
    && typeof value.id === "string" && value.id.startsWith("_");
  const parsed = (isComment ? commentSchema : rowSchema).safeParse(value);
  if (!parsed.success) {
    const details = parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join(", ");
    throw new Error(`Line ${line}: ${details}`);
  }
  if (ids.has(parsed.data.id)) throw new Error(`Line ${line}: duplicate id ${parsed.data.id}`);
  ids.add(parsed.data.id);
  return parsed.data;
}

export function readJsonl(input: string): Entry[] {
  const ids = new Set<string>();
  return input.replace(/^\uFEFF/, "").split(/\r?\n/).flatMap((line, index) => {
    if (!line.trim()) return [];
    let value: unknown;
    try { value = JSON.parse(line); } catch { throw new Error(`Line ${index + 1}: invalid JSON`); }
    return [checkEntry(value, index + 1, ids)];
  });
}
