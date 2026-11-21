import "server-only";
import type { Snapshot } from "@/lib/domain/types";
import { scenarioRegistry } from "@/lib/scenarios";
import { deskSamples } from "@/lib/scenarios/desk-copy";
import { heroFollowups } from "@/lib/domain/chat-samples";
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
  const samples = [...deskSamples(snapshot.scenario.id), ...(registered?.sampleMessages ?? [])];
  const sample = samples.find(({ text }) => normalizeWhitespace(text) === normalized);
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

export function offlineChat(message: string, snapshot: Snapshot) {
  const text = normalizeWhitespace(message);
  const sample = snapshot.scenario.id === "hero" && (
    heroFollowups.find(item => text === item.text) ??
    (text === "คลัง A กลับมาหยิบ SKU-X ได้แล้วตั้งแต่ 13:30 น." ? heroFollowups[2] : undefined)
  );
  if (!sample) {
    const result = offlineInterpret(message, snapshot);
    return { ...result, event_type: result.kind === "incident" ? "outage" : null, event_time: null, quantity: null };
  }
  return {
    evidence_quote: message.trim(), kind: "incident", event_type: sample.type,
    warehouse: { delay: "B", stock_found: "C", resumed: "A" }[sample.type],
    skus: sample.type === "delay" ? [] : ["SKU-X"], window_start: null, window_end: null,
    event_time: sample.type === "resumed" ? "13:30" : sample.type === "delay" ? "14:30" : null,
    quantity: sample.type === "stock_found" ? 4 : null, clarify_about: null, clarification_question: null,
  };
}
