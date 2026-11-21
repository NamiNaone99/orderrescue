import { expect, it, vi } from "vitest";
import { interpret, type InterpreterClient } from "@/lib/interpreter/chain";
import { heroSampleMessages, heroSnapshot, heroTime } from "@/lib/scenarios/hero";

const hero = heroSampleMessages[0];

function stubIncident(warehouse: string, start: string, end: string, quote: string): InterpreterClient {
  return {
    name: "openai:stub",
    run: async () => ({
      status: "parsed",
      output: { ...hero.expected, warehouse, window_start: start, window_end: end, evidence_quote: quote },
    }),
  };
}

it.each([
  ["SKU-X", "warehouse"],
  ["SKU-X รอบบ่ายหยิบไม่ได้ค่ะ ช่วยแจ้งคนจัดของด้วย", "warehouse"],
  ["คลังเอาของไปส่งแล้ว SKU-X รอบบ่าย", "warehouse"],
  ["วิตามินบี SKU-X งดหยิบรอบบ่ายค่ะ", "warehouse"],
  ["ฝั่งคลัง B แจ้งว่า SKU-X รอบบ่ายหยิบไม่ได้ค่ะ", "warehouse"],
  ["บางนาแจ้งว่า SKU-X ยังหยิบไม่ได้ค่ะ", "time"],
  ["คลัง A ขอพัก SKU-X สักพักนะ", "time"],
  ["คลัง A ขอพัก SKU-X บ่ายนี้ถึงหกโมงเย็น", "time"],
  ["คลัง A แจ้ง SKU-X งดหยิบถึง 18:00", "time"],
  ["คลัง A แจ้ง SKU-X งดหยิบถึง 18:00 นาฬิกาค่ะ", "time"],
  ["คลัง A งดหยิบ SKU-X ตั้งแต่ 14:00 ถึง 16:00", "time"],
  ["คลัง A ขอพัก SKU-X รอบเช้า", "time"],
] as const)("asks for missing or unsupported incident details in %s", async (message, about) => {
  const first = stubIncident("A", "13:00", "18:00", "SKU-X");
  const second = { ...first, run: vi.fn(first.run) };
  const answer = await interpret(message, heroSnapshot, { clients: [first, second] });
  expect(answer).toMatchObject({
    outcome: "clarification", incident: null, clarification: { about },
    validation: { ok: false, issues: ["V1"] },
    interpreter: { used: first.name, attempts: [{ name: first.name, ok: false, reason: "V1" }] },
  });
  expect(second.run).not.toHaveBeenCalled();
});

it.each([
  [hero.text, "A", "13:00", "18:00", hero.expected.evidence_quote],
  ["กะเช้าวันนี้บางนาแจ้งว่า SKU-X ยังหยิบไม่ได้นะ", "A", "08:00", "12:00", "ยังหยิบไม่ได้"],
  ["รับแจ้งจากโกดังบีค่ะ SKU-X หยิบไม่ได้ 9.15 จนถึง 11.45 น.", "B", "09:15", "11:45", "หยิบไม่ได้"],
  ["คลังซี SKU-X หยิบไม่ได้ตั้งแต่ ๑๔:๐๐ ถึง ๑๖:๐๐ น.", "C", "14:00", "16:00", "หยิบไม่ได้"],
  ["คลังเอขอพัก SKU-X บ่ายโมงถึงหกโมงเย็นค่ะ", "A", "13:00", "18:00", "ขอพัก SKU-X"],
  ["สาขาบีงดหยิบ SKU-X ตั้งแต่หกโมงเช้าถึงหกโมงเย็น", "B", "06:00", "18:00", "งดหยิบ SKU-X"],
  ["คลัง A ขอพัก SKU-X จาก 13 น. ถึง 18 น.", "A", "13:00", "18:00", "ขอพัก SKU-X"],
  ["SKU-X จากลาดกระบังพักหยิบ 13:00 ถึง 18:00 นะคะ", "B", "13:00", "18:00", "พักหยิบ"],
] as const)("accepts explicit source evidence in %s", async (message, warehouse, start, end, quote) => {
  const answer = await interpret(message, heroSnapshot, { clients: [stubIncident(warehouse, start, end, quote)] });
  expect(answer).toMatchObject({
    outcome: "incident", validation: { ok: true, issues: [] },
    incident: { warehouse_id: warehouse, window_start: heroTime(start), window_end: heroTime(end), evidence_quote: quote },
  });
});
