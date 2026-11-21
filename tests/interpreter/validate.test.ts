import { describe, expect, it } from "vitest";
import { heroSampleMessages, heroSnapshot, heroTime } from "@/lib/scenarios/hero";
import { rawInterpretationSchema, type RawInterpretation } from "@/lib/interpreter/schema";
import { checkMessage, InvalidMessageError, InvalidOutputError, validate } from "@/lib/interpreter/validate";

const sample = heroSampleMessages[0];

function incident(changes: Partial<RawInterpretation> = {}) {
  return validate({ ...sample.expected, ...changes }, sample.text, heroSnapshot);
}

describe("raw interpreter output", () => {
  it("requires all eight keys in the specified schema order", () => {
    const keys = [
      "evidence_quote", "kind", "warehouse", "skus", "window_start", "window_end",
      "clarify_about", "clarification_question",
    ];
    expect(Object.keys(rawInterpretationSchema.shape)).toEqual(keys);
    for (const key of keys) {
      const partial: Record<string, unknown> = { ...sample.expected };
      delete partial[key];
      expect(rawInterpretationSchema.safeParse(partial).success).toBe(false);
    }
    expect(rawInterpretationSchema.safeParse(heroSampleMessages[2].expected).success).toBe(true);
  });

  it("raises a distinct error on extra keys, invalid enums or a non-object", () => {
    for (const raw of [{ ...sample.expected, qty: 8 }, { ...sample.expected, clarify_about: "other" }, null]) {
      expect(() => validate(raw, sample.text, heroSnapshot)).toThrow(InvalidOutputError);
    }
  });
});

describe("message validation", () => {
  it("V6 checks the trimmed 1–500 character bounds and exposes status 422", () => {
    expect(checkMessage("  ก  ")).toBe("ก");
    expect(checkMessage(` ${"ก".repeat(500)} `)).toHaveLength(500);
    for (const text of ["", " \t ", "ก".repeat(501)]) {
      expect(() => checkMessage(text)).toThrow(InvalidMessageError);
      expect(() => validate(null, text, heroSnapshot)).toThrow(expect.objectContaining({
        code: "INVALID_INPUT", status: 422,
      }));
    }
  });
});

describe("incident validation", () => {
  it("normalizes the warehouse ID and uses the Bangkok scenario date", () => {
    expect(incident({ warehouse: "a" })).toEqual({
      outcome: "incident",
      incident: {
        warehouse_id: "A", sku_ids: ["SKU-X"], window_start: heroTime("13:00"),
        window_end: heroTime("18:00"), evidence_quote: sample.expected.evidence_quote,
      },
      clarification: null, validation: { ok: true, issues: [] },
    });
  });

  it.each([
    [{ warehouse: null }, "warehouse"], [{ skus: [] }, "sku"],
    [{ window_start: null }, "time"], [{ window_end: null }, "time"],
  ] as const)("V1 asks for a missing incident part", (changes, about) => {
    expect(validate({ ...sample.expected, ...changes }, sample.text, heroSnapshot)).toMatchObject({
      outcome: "clarification", incident: null, clarification: { about }, validation: { ok: false, issues: ["V1"] },
    });
  });

  it("V2 accepts only warehouse IDs in the supplied snapshot", () => {
    const snapshot = { ...heroSnapshot, warehouses: heroSnapshot.warehouses.filter(row => row.id !== "B") };
    for (const warehouse of ["B", "เอ", "unknown"]) {
      expect(validate({ ...sample.expected, warehouse }, sample.text, snapshot)).toMatchObject({
        outcome: "clarification", incident: null, clarification: { about: "warehouse" }, validation: { issues: ["V2"] },
      });
    }
  });

  it("V3 names every unknown SKU even when another SKU is valid", () => {
    const checked = incident({ skus: ["SKU-X", "unknown1", "unknown2"] });
    expect(checked).toMatchObject({
      outcome: "clarification", incident: null, clarification: { about: "sku" }, validation: { issues: ["V3"] },
    });
    expect(checked.clarification?.question_th).toContain("unknown1");
    expect(checked.clarification?.question_th).toContain("unknown2");
  });

  it("accepts a product named in full and asks when its code is only part of another code", () => {
    const byName = sample.text.replace("SKU-X", heroSnapshot.skus[0].name);
    const otherCode = sample.text.replace("SKU-X", "SKU-XX");
    for (const [message, outcome] of [[byName, "incident"], [otherCode, "clarification"]] as const) {
      expect(validate({ ...sample.expected, evidence_quote: message }, message, heroSnapshot).outcome).toBe(outcome);
    }
  });

  it.each([
    ["9:00", "12:00"], ["12:60", "13:00"], ["12:00", "24:00"], ["12:00", "12:00"], ["23:00", "01:00"],
  ])("V4 requires a valid same-day window for %s–%s", (window_start, window_end) => {
    expect(incident({ window_start, window_end })).toMatchObject({
      outcome: "clarification", incident: null, clarification: { about: "time" }, validation: { issues: ["V4"] },
    });
  });

  it.each([null, "", " ", "ข้อความที่ไม่มี", "งดหยิบ  SKU-X"])("V5 requires a nonblank verbatim span", evidence_quote => {
    expect(incident({ evidence_quote })).toMatchObject({
      outcome: "clarification", incident: null, clarification: { about: "other" }, validation: { issues: ["V5"] },
    });
  });

  it("V5 preserves whitespace that belongs to a verbatim span at the message boundary", () => {
    const evidence_quote = `${sample.expected.evidence_quote}  `;
    const message = `  ${sample.text}  `;
    expect(validate({ ...sample.expected, evidence_quote }, message, heroSnapshot)).toMatchObject({
      outcome: "incident", incident: { evidence_quote }, validation: { ok: true, issues: [] },
    });
  });
});

describe("clarification and ignore outcomes", () => {
  it("V7 preserves the supplied Thai question", () => {
    const { expected, text } = heroSampleMessages[1];
    expect(validate(expected, text, heroSnapshot)).toEqual({
      outcome: "clarification", incident: null,
      clarification: { about: "warehouse", question_th: expected.clarification_question },
      validation: { ok: true, issues: [] },
    });
  });

  it("V7 supplies a distinct Thai question for each missing clarification topic", () => {
    const questions = new Set<string>();
    for (const about of ["warehouse", "sku", "time", "conflict", null] as const) {
      const checked = incident({ kind: "clarification", clarify_about: about, clarification_question: null });
      expect(checked).toMatchObject({
        outcome: "clarification", incident: null,
        clarification: { about: about ?? "other", question_th: expect.stringMatching(/[ก-ฮ]/) },
        validation: { issues: ["V7"] },
      });
      if (checked.clarification) questions.add(checked.clarification.question_th);
    }
    expect(questions.size).toBe(5);
    expect(incident({ kind: "clarification", clarification_question: "Which warehouse?" }).validation.issues).toEqual(["V7"]);
  });

  it("V8 drops all incident and clarification fields for ignore", () => {
    expect(incident({ kind: "ignore", warehouse: "unknown", evidence_quote: null })).toEqual({
      outcome: "ignore", incident: null, clarification: null, validation: { ok: true, issues: [] },
    });
  });
});
