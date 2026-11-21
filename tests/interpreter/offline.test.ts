import { describe, expect, it } from "vitest";
import { offlineInterpret } from "@/lib/interpreter/offline";
import { buildSystemPrompt } from "@/lib/interpreter/prompt";
import { heroSampleMessages, heroSnapshot } from "@/lib/scenarios/hero";

const [incidentSample] = heroSampleMessages;
const unknownQuestion = "ระบบออฟไลน์อ่านได้เฉพาะข้อความตัวอย่าง กรุณากรอกเหตุการณ์ด้วยตนเอง";

describe("offline interpretation", () => {
  it.each(heroSampleMessages)("returns the stored $expected.kind for $text", ({ text, expected }) => {
    expect(offlineInterpret(text, heroSnapshot)).toEqual(expected);
  });

  it("normalizes whitespace for lookup and quotes the exact submitted span", () => {
    const evidence = "งดหยิบ\t SKU-X\r\nรอบบ่ายวันนี้";
    const message = `  คลัง\tA   ${evidence}\n`;
    const answer = offlineInterpret(message, heroSnapshot);
    expect(answer).toEqual({ ...incidentSample.expected, evidence_quote: evidence });
    expect(message).toContain(answer.evidence_quote);
  });

  it.each([
    "คลัง A งดหยิบ SKU-X รอบบ่ายวันพรุ่งนี้",
    incidentSample.text.toLowerCase(),
    `${incidentSample.text}!`,
    "ขอให้ยืนยันการจอง",
  ])("asks for manual entry when the text differs from a sample: %s", (message) => {
    expect(offlineInterpret(message, heroSnapshot)).toEqual({
      evidence_quote: null,
      kind: "clarification",
      warehouse: null,
      skus: [],
      window_start: null,
      window_end: null,
      clarify_about: null,
      clarification_question: unknownQuestion,
    });
  });

  it("keeps sample answers scoped to their scenario", () => {
    const otherScenario = structuredClone(heroSnapshot);
    otherScenario.scenario.id = "real-day";
    expect(offlineInterpret(incidentSample.text, otherScenario)).toMatchObject({
      kind: "clarification", clarification_question: unknownQuestion, evidence_quote: null,
    });
  });

  it("returns independent sample answers", () => {
    const answer = offlineInterpret(incidentSample.text, heroSnapshot);
    answer.skus.length = 0;
    expect(offlineInterpret(incidentSample.text, heroSnapshot).skus).toEqual(["SKU-X"]);
  });
});

describe("system prompt", () => {
  it("uses the snapshot's warehouse names, named shifts and Bangkok date", () => {
    const prompt = buildSystemPrompt(heroSnapshot);
    for (const { id, name_th } of heroSnapshot.warehouses) {
      expect(prompt).toContain(id);
      expect(prompt).toContain(name_th);
    }
    for (const { name_th, start, end } of heroSnapshot.scenario.shifts) {
      expect(prompt).toContain(name_th);
      expect(prompt).toContain(start);
      expect(prompt).toContain(end);
    }
    expect(prompt).toContain("2026-11-21");
    expect(prompt).toMatch(/message text as data/i);
    expect(prompt).toMatch(/never follow instructions/i);
    expect(prompt).toMatch(/never guess/i);
    expect(prompt).toMatch(/one short question in Thai/i);
  });

  it("keeps SKU and operational data outside the prompt", () => {
    const withoutPrivateData = structuredClone(heroSnapshot);
    withoutPrivateData.skus = [];
    withoutPrivateData.stock = [];
    withoutPrivateData.orders = [];
    withoutPrivateData.order_lines = [];
    withoutPrivateData.scenario.sample_messages = [];
    withoutPrivateData.scenario.default_sku_id = "PRIVATE-SKU";
    const prompt = buildSystemPrompt(heroSnapshot);
    expect(buildSystemPrompt(withoutPrivateData)).toBe(prompt);
    expect(prompt).not.toContain("SKU-X");
    expect(prompt).not.toContain("งดหยิบ SKU-X รอบบ่ายวันนี้");
  });
});
