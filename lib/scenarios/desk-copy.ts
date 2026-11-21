import "server-only";
import type { Scenario, ScenarioId } from "@/lib/domain/types";
import { heroSampleMessages } from "./hero";
import { realDaySamples } from "./realDayFormat";

const heroDeskSamples = [
  {
    text: "คลัง A เตรียม SKU-X ให้ทันรอบบ่ายวันนี้ไม่ได้ครับ",
    label_th: "เตรียมของไม่ทันรอบบ่าย",
    expected: { ...heroSampleMessages[0].expected, evidence_quote: "เตรียม SKU-X ให้ทันรอบบ่ายวันนี้ไม่ได้" },
  },
  {
    text: "ของตัวนี้เตรียมไม่ทันรอบบ่ายครับ",
    label_th: heroSampleMessages[1].label_th,
    expected: { ...heroSampleMessages[1].expected, clarification_question: "คลังไหนเตรียมของไม่ทันรอบส่งคะ" },
  },
  heroSampleMessages[2],
] as const;

const realDayDeskSamples = [
  {
    text: "คลัง A เตรียมสินค้า 23084 ไม่ได้ช่วง 13:00–18:00 วันนี้ เพราะชั้นวางพัง",
    label_th: realDaySamples[0].label_th,
    expected: { ...realDaySamples[0].expected, evidence_quote: "เตรียมสินค้า 23084 ไม่ได้ช่วง 13:00–18:00" },
  },
  {
    text: "คลัง A เตรียมสินค้า 23084 กับ 23355 ไม่ได้ช่วง 14:00–16:00",
    label_th: realDaySamples[1].label_th,
    expected: { ...realDaySamples[1].expected, evidence_quote: "เตรียมสินค้า 23084 กับ 23355 ไม่ได้ช่วง 14:00–16:00" },
  },
] as const;

export function deskSamples(id: ScenarioId) {
  if (id === "hero") return heroDeskSamples;
  if (id === "real-day") return realDayDeskSamples;
  return [];
}

export function deskScenario(scenario: Scenario): Scenario {
  const samples = deskSamples(scenario.id);
  return {
    ...scenario,
    name_th: scenario.id === "hero" ? "ตัวอย่างเตรียมของไม่ทันรอบส่ง" : scenario.name_th,
    sample_messages: samples.length ? samples.map(({ text, label_th }) => ({ text, label_th })) : scenario.sample_messages,
  };
}
