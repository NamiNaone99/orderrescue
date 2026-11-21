import { interpretRequestSchema, type InterpretResponse } from "@/lib/domain/contracts";
import { bangkokTimestamp } from "@/lib/domain/time";
import type { Snapshot } from "@/lib/domain/types";
import { rawInterpretationSchema } from "./schema";

type WithoutInterpreter<T> = T extends InterpretResponse ? Omit<T, "interpreter"> : never;
export type ValidatedInterpretation = WithoutInterpreter<InterpretResponse>;
type Clarification = Extract<ValidatedInterpretation, { outcome: "clarification" }>;
type About = Clarification["clarification"]["about"];

const questions: Record<About, string> = {
  warehouse: "คลังไหนหยิบสินค้าไม่ได้คะ",
  sku: "สินค้าที่หยิบไม่ได้มีรหัส SKU อะไรบ้างคะ",
  time: "คลังหยิบสินค้าไม่ได้ตั้งแต่กี่โมงถึงกี่โมงคะ",
  conflict: "ข้อมูลในข้อความขัดกันค่ะ ข้อมูลใดถูกต้องคะ",
  other: "ช่วยระบุคลัง รหัสสินค้า และช่วงเวลาที่หยิบไม่ได้อีกครั้งได้ไหมคะ",
};

export class InvalidMessageError extends Error {
  readonly code = "INVALID_INPUT";
  readonly status = 422;
  constructor() {
    super("Expected a message of 1 to 500 characters after trimming");
    this.name = "InvalidMessageError";
  }
}

export class InvalidOutputError extends Error {
  constructor() {
    super("Interpreter output did not match the required schema");
    this.name = "InvalidOutputError";
  }
}

export function checkMessage(message: string): string {
  const result = interpretRequestSchema.shape.message.safeParse(message);
  if (!result.success) throw new InvalidMessageError();
  return result.data;
}

function clarify(about: About, issue?: string, question = questions[about]): Clarification {
  return {
    outcome: "clarification",
    incident: null,
    clarification: { about, question_th: question },
    validation: { ok: !issue, issues: issue ? [issue] : [] },
  };
}

const clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
// Booking requests belong to the operator confirmation flow (AC-22).
const bookingCommand = /\b(?:book|reserve)\s+(?:all|every\w*|the|orders?|stock|sku)\b|(?:^|\s|ช่วย|กรุณา|โปรด)จอง/iu;

function mentionsItem(message: string, id: string, name: string | undefined): boolean {
  const escapedId = id.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&");
  const wholeId = new RegExp("(^|[^a-z0-9_-])" + escapedId + "($|[^a-z0-9_-])", "i");
  if (wholeId.test(message)) return true;
  return name !== undefined && name.toLowerCase() !== id.toLowerCase() && message.toLowerCase().includes(name.toLowerCase());
}

const thaiWords = new Intl.Segmenter("th", { granularity: "word" });
const writtenClock = /(?<!\d)([01]?\d|2[0-3])(?:[:.]([0-5]\d)(?!\d)|\s*น\.)/gu;
const spokenClock = /บ่ายโมง|เที่ยง(?:คืน|วัน)?|(?:บ่าย|ตี)\s*(?:หนึ่ง|สอง|สาม|สี่|ห้า|หก|\d+)|(?:หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ(?:เอ็ด)?|\d+)\s*(?:โมง(?:เช้า|เย็น)?|ทุ่ม|นาฬิกา)/gu;

function mentionsWarehouse(message: string, warehouse: Snapshot["warehouses"][number]): boolean {
  // Both scenarios label locations as "คลัง A บางนา"; dispatchers also use just the place name.
  const place = warehouse.name_th.replace(/^คลัง\s+\S+\s+/u, "");
  if (mentionsItem(message, warehouse.id, place)) return true;
  // The model normalizes spoken IDs. Check the name in location context so วิตามินบี and เอาของ do not count.
  const labels = message.matchAll(/(?:^|คลัง|โกดัง|สาขา|ฝั่ง|ทาง|จาก|ที่)\s*(?=เอ|บี|ซี)/gu);
  return Array.from(labels).some(label => {
    const afterLabel = message.slice(label.index + label[0].length);
    const name = thaiWords.segment(afterLabel).containing(0)?.segment;
    return name === "เอ" || name === "บี" || name === "ซี";
  });
}

function mentionsWindow(message: string, start: string, end: string, shifts: Snapshot["scenario"]["shifts"]): boolean {
  const text = message.replace(/กะ(?=เช้า|บ่าย)/gu, "รอบ")
    .replace(/[๐-๙]/gu, digit => String(digit.charCodeAt(0) - "๐".charCodeAt(0)));
  if (shifts.some(shift => shift.start === start && shift.end === end && text.includes(shift.name_th))) return true;

  const times = new Set<string>();
  const remainingText = text.replace(writtenClock, (_clock, hour: string, minute?: string) => {
    times.add(hour.padStart(2, "0") + ":" + (minute ?? "00"));
    return " ";
  });
  const missing = [start, end].filter(time => !times.has(time));
  if (missing.length === 0) return true;

  // Spoken endpoints remain model-interpreted. A vague start and a single explicit end cannot make a window.
  return new Set(remainingText.match(spokenClock)).size >= missing.length;
}

export function validate(raw: unknown, message: string, snapshot: Snapshot): ValidatedInterpretation {
  const text = checkMessage(message);
  const parsed = rawInterpretationSchema.safeParse(raw);
  if (!parsed.success) throw new InvalidOutputError();
  const output = parsed.data;
  const valid = { ok: true, issues: [] };
  if (output.kind === "ignore") {
    return { outcome: "ignore", incident: null, clarification: null, validation: valid };
  }
  if (output.kind === "clarification") {
    const about = output.clarify_about ?? "other";
    const question = output.clarification_question?.trim();
    return question && /[ก-ฮ]/.test(question) ? clarify(about, undefined, question) : clarify(about, "V7");
  }

  const { warehouse, skus, window_start, window_end, evidence_quote } = output;
  if (!warehouse?.trim()) return clarify("warehouse", "V1");
  if (skus.length === 0) return clarify("sku", "V1");
  if (!window_start || !window_end) return clarify("time", "V1");

  const knownWarehouse = snapshot.warehouses.find(item => item.id === warehouse.trim().toUpperCase());
  if (!knownWarehouse) return clarify("warehouse", "V2");
  const knownSkus = new Map(snapshot.skus.map(sku => [sku.id, sku.name]));
  const unknown = [...new Set(skus.filter(sku => !knownSkus.has(sku)))];
  if (unknown.length) {
    return clarify("sku", "V3", `ไม่พบรหัสสินค้า ${unknown.join(", ")} ในสถานการณ์นี้ รหัสสินค้าที่ถูกต้องคืออะไรคะ`);
  }
  if (!clock.test(window_start) || !clock.test(window_end) || window_start >= window_end) {
    return clarify("time", "V4");
  }
  if (!evidence_quote?.trim() || !message.includes(evidence_quote)) return clarify("other", "V5");
  if (bookingCommand.test(text)) return clarify("other", "AC-22");
  if (skus.some(id => !mentionsItem(text, id, knownSkus.get(id)))) return clarify("sku", "V1");
  if (!mentionsWarehouse(text, knownWarehouse)) return clarify("warehouse", "V1");
  if (!mentionsWindow(text, window_start, window_end, snapshot.scenario.shifts)) return clarify("time", "V1");

  const date = snapshot.scenario.now_at.slice(0, 10);
  return {
    outcome: "incident",
    incident: {
      warehouse_id: knownWarehouse.id,
      sku_ids: skus,
      window_start: bangkokTimestamp(date, window_start),
      window_end: bangkokTimestamp(date, window_end),
      evidence_quote,
    },
    clarification: null,
    validation: valid,
  };
}
