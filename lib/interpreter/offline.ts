import "server-only";
import type { Snapshot } from "@/lib/domain/types";
import { scenarioRegistry } from "@/lib/scenarios";
import { rawInterpretationSchema, type RawInterpretation } from "./schema";

function normalizeWhitespace(text: string): string {
  return text.trim().replace(/\s+/gu, " ");
}

function unknownMessage(): RawInterpretation {
  return {
    evidence_quote: null,
    kind: "clarification",
    warehouse: null,
    skus: [],
    window_start: null,
    window_end: null,
    clarify_about: null,
    clarification_question: "ระบบออฟไลน์อ่านได้เฉพาะข้อความตัวอย่าง กรุณากรอกเหตุการณ์ด้วยตนเอง",
  };
}

export function offlineInterpret(message: string, snapshot: Snapshot): RawInterpretation {
  const registered = Object.values(scenarioRegistry).find(
    (entry) => entry.snapshot.scenario.id === snapshot.scenario.id,
  );
  const normalized = normalizeWhitespace(message);
  const sample = registered?.sampleMessages.find(({ text }) => normalizeWhitespace(text) === normalized);
  if (!sample) return unknownMessage();

  const result = rawInterpretationSchema.parse(sample.expected);
  const quote = result.evidence_quote;
  if (quote === null || message.includes(quote)) return result;

  // Keep the original whitespace inside the evidence when the matching message used tabs or newlines.
  const words = normalizeWhitespace(quote).split(" ").map(word => word.replace(/[.*+?^$(){}|[\]\\]/gu, "\\$&"));
  const matched = message.match(new RegExp(words.join("\\s+"), "u"));
  if (!matched) return unknownMessage();
  return { ...result, evidence_quote: matched[0] };
}
