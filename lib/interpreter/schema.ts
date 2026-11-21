import { z } from "zod";

export const rawInterpretationSchema = z.strictObject({
  evidence_quote: z.string().nullable().describe("Verbatim span copied from the message that states the incident"),
  kind: z.enum(["incident", "clarification", "ignore"]),
  warehouse: z.string().nullable().describe("Warehouse id, e.g. A"),
  skus: z.array(z.string()),
  window_start: z.string().nullable().describe("HH:MM, 24h, Asia/Bangkok, scenario date"),
  window_end: z.string().nullable().describe("HH:MM"),
  clarify_about: z.enum(["warehouse", "sku", "time", "conflict"]).nullable(),
  clarification_question: z.string().nullable().describe("One short question in Thai"),
});

export type RawInterpretation = z.infer<typeof rawInterpretationSchema>;
