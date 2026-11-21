import { afterEach, expect, it, vi } from "vitest";
import { heroFollowups } from "@/lib/domain/chat-samples";
import { interpretResponseSchema, warehouseEventSchema, type ChatContext } from "@/lib/domain/contracts";
import { interpret } from "@/lib/interpreter/chain";
import { validateChat, verifiedReport } from "@/lib/interpreter/chat";
import { offlineChat } from "@/lib/interpreter/offline";
import { createOpenAIInterpreter } from "@/lib/interpreter/openai";
import { chatInterpretationSchema } from "@/lib/interpreter/schema";
import { heroIncident, heroSampleMessages, heroSnapshot, heroTime } from "@/lib/scenarios/hero";

const { warehouse_id, sku_id, window_start, window_end } = heroIncident;
const context = { incident: { warehouse_id, sku_id, window_start, window_end } };
const raw = (type: number) => offlineChat(heroFollowups[type].text, heroSnapshot);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it.each(heroFollowups)(
  "reads the $type hero message offline, grounds the quote and supplies a strict typed event",
  async (sample) => {
    const answer = interpretResponseSchema.parse(await interpret(sample.text, heroSnapshot, { chat: context }));
    expect(answer.outcome).toBe("event");
    if (answer.outcome !== "event") throw new Error("Expected a grounded event");
    expect(answer.interpreter.used).toBe("offline");
    expect(answer.evidence_quote).toBe(sample.text);
    expect(answer.event).toEqual(
      sample.type === "delay"
        ? { type: "delay", warehouse_id: "B", sku_id, at: heroTime("14:30") }
        : sample.type === "stock_found"
          ? { type: "stock_found", warehouse_id: "C", sku_id, quantity: 4 }
          : { type: "resumed", ...context.incident, at: heroTime("13:30") },
    );
    expect(warehouseEventSchema.safeParse({ ...answer.event, unit_cost_thb: 5 }).success).toBe(false);
  },
);

it("returns the existing outage through the extended format and keeps unknown offline input on the clarification path", async () => {
  const sample = heroSampleMessages[0];
  const answer = await interpret(sample.text, heroSnapshot, { chat: { incident: null } });
  expect(answer).toMatchObject({
    outcome: "incident",
    event_type: "outage",
    incident: { evidence_quote: sample.expected.evidence_quote },
  });
  expect((await interpret("เรื่องอื่น ๆ", heroSnapshot, { chat: context })).outcome).toBe("clarification");
});

it.each([
  ["no matching time", 0, "คลัง B รถช้า", { event_time: "14:30" }],
  ["different spoken time", 0, "คลัง B รถออกได้บ่ายสามครึ่ง", { event_time: "14:30" }],
  ["different day", 0, "พรุ่งนี้คลัง B รถออกได้ 14:30", { event_time: "14:30" }],
  ["range with shared unit", 1, "คลัง C พบ SKU-X เพิ่ม 3 ถึง 4 หน่วย", { quantity: 4 }],
  ["unknown warehouse", 0, "รถคลัง D ออกได้ 14:30", { warehouse: "D" }],
  ["different named warehouse", 0, "รถสาขาซีออกได้ 14:30", { warehouse: "B" }],
  ["direct negation", 0, "คลัง B ไม่เลื่อนเป็น 14:30", { event_time: "14:30" }],
  ["two times", 0, "คลัง B เลื่อนเป็น 14:30; รถออกได้ 15:15", { evidence_quote: "คลัง B เลื่อนเป็น 14:30" }],
  [
    "two quantities",
    1,
    "คลัง C พบ SKU-X เพิ่ม 4 หน่วย; ยอดสุดท้าย 6 หน่วย",
    { evidence_quote: "คลัง C พบ SKU-X เพิ่ม 4 หน่วย" },
  ],
  [
    "another SKU in full message",
    1,
    "คลัง C พบ SKU-X เพิ่ม 4 หน่วย และ SKU-Y ด้วย",
    { evidence_quote: "คลัง C พบ SKU-X เพิ่ม 4 หน่วย" },
  ],
  ["missing unit quantity", 1, "คลัง C พบ SKU-X เพิ่ม", { quantity: 4 }],
  ["negative extra units", 1, "คลัง C พบ SKU-X เพิ่ม -4 หน่วย", { quantity: 4 }],
  ["quantity mismatch", 1, "คลัง C พบ SKU-X เพิ่ม 8 หน่วย", { quantity: 4 }],
  ["fractional stock", 1, "คลัง C พบ SKU-X เพิ่ม 4.5 หน่วย", { quantity: 5 }],
  ["unknown product", 1, "คลัง C พบ SKU-Z เพิ่ม 4 หน่วย", { skus: ["SKU-Z"] }],
  ["no actual resumption", 2, "คลัง A SKU-X เวลา 13:30", { event_time: "13:30" }],
  ["resumed outside outage", 2, "คลัง A กลับมาหยิบ SKU-X ได้ตั้งแต่ 19:30", { event_time: "19:30" }],
] as const)("clarifies %s even when given a parsed model result", (_, index, message, changes) => {
  const answer = validateChat(
    { ...raw(index), evidence_quote: message, ...changes },
    message,
    heroSnapshot,
    context,
  );
  expect(answer.outcome).toBe("clarification");
});

it("requires evidence, distinct numeric fields and a strict flat provider object", () => {
  const base = raw(0);
  expect(
    validateChat({ ...base, evidence_quote: "missing" }, heroFollowups[0].text, heroSnapshot, context).validation
      .issues,
  ).toEqual(["V5"]);
  expect(chatInterpretationSchema.safeParse({ ...base, extra: true }).success).toBe(false);
  expect(chatInterpretationSchema.safeParse({ ...base, quantity: 1.5 }).success).toBe(false);
  expect(validateChat({ ...base, quantity: 1 }, heroFollowups[0].text, heroSnapshot, context).outcome).toBe(
    "clarification",
  );
  expect(validateChat(raw(2), heroFollowups[2].text, heroSnapshot, { incident: null }).outcome).toBe(
    "clarification",
  );
});

it("uses the selected real-day SKU without inferring it from unrelated stock", () => {
  const snapshot = {
    ...heroSnapshot,
    scenario: { ...heroSnapshot.scenario, id: "real-day" as const },
    skus: [
      { id: "23084", name: "item 1" },
      { id: "23100", name: "item 2" },
    ],
    stock: heroSnapshot.stock.map((row) => ({ ...row, sku_id: "23084" })),
  };
  const msg = "รถสาขาบีออกได้ ๑๔:๔๕";
  const answer = (ctx: ChatContext) =>
    validateChat({ ...raw(0), evidence_quote: msg, event_time: "14:45" }, msg, snapshot, ctx);
  expect(answer({ incident: null })).toMatchObject({ outcome: "clarification", clarification: { about: "sku" } });
  expect(answer({ incident: { ...context.incident, sku_id: "23084" } })).toMatchObject({
    outcome: "event",
    event: { type: "delay", sku_id: "23084", at: heroTime("14:45") },
  });
});

it("rechecks a confirmed payload against the whole message, including evidence omitted by the model", () => {
  const proposed = { type: "stock_found" as const, warehouse_id: "C" as const, sku_id, quantity: 4 };
  const quote = heroFollowups[1].text;
  const apply = (message: string) =>
    verifiedReport(
      {
        scenario: "hero",
        key: crypto.randomUUID(),
        message,
        chat: context,
        evidence_quote: quote,
        event: proposed,
      },
      heroSnapshot,
    );
  expect(apply(quote)).toEqual(proposed);
  expect(apply(quote + " แต่ไม่พบของจริง")).toBeNull();
  expect(apply(quote + "; ยอดอีก 8 หน่วย")).toBeNull();
});

it("uses the strict chat schema through the real SDK transport, validates its output and sends no operational state", async () => {
  vi.stubEnv("OPENAI_API_KEY", "inert-test-value");
  const message = "คลัง C พบ SKU-X เพิ่ม 7 กล่อง";
  const response = { ...raw(1), quantity: 7, evidence_quote: message };
  const transport = vi
    .fn()
    .mockResolvedValue(
      Response.json({
        object: "response",
        status: "completed",
        output: [
          {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: JSON.stringify(response) }],
          },
        ],
      }),
    );
  vi.stubGlobal("fetch", transport);
  vi.spyOn(console, "info").mockImplementation(() => {});
  const result = await interpret(message, heroSnapshot, {
    chat: context,
    clients: [createOpenAIInterpreter("stub-model")],
  });
  expect(result).toMatchObject({
    outcome: "event",
    event: { quantity: 7 },
    interpreter: { used: "openai:stub-model" },
  });
  const body = JSON.parse(String(transport.mock.calls[0][1].body));
  expect(body.store).toBe(false);
  expect(body.input).toBe(message);
  expect(body.text.format).toMatchObject({
    name: "warehouse_report",
    strict: true,
    schema: { type: "object", additionalProperties: false, required: Object.keys(chatInterpretationSchema.shape) },
  });
  expect(body.instructions).not.toMatch(/SKU-X|order_id|customer_ref|state_version/);
});
