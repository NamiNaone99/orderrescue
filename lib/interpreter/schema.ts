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

// The chat format is a flat strict object for Structured Outputs. Existing outage-only callers keep their contract.
export const chatInterpretationSchema = rawInterpretationSchema.extend({
  event_type: z.enum(["outage", "delay", "stock_found", "resumed"]).nullable(),
  event_time: z.string().nullable().describe("The explicitly reported new readiness or resumption time, HH:MM"),
  quantity: z.int().nullable().describe("Additional units explicitly found, otherwise null"),
});
export type RawChatInterpretation = z.infer<typeof chatInterpretationSchema>;
