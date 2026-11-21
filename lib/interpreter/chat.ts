import type { ChatApply, ChatContext, WarehouseEvent } from "@/lib/domain/contracts";
import { bangkokTimestamp } from "@/lib/domain/time";
import type { Snapshot } from "@/lib/domain/types";
import { chatCopy as c } from "@/lib/copy";
import { chatInterpretationSchema, type RawChatInterpretation } from "./schema";
import {
  checkMessage,
  clarify,
  InvalidOutputError,
  mentionsItem,
  validate,
  type ValidatedInterpretation,
} from "./validate";

const thaiNumbers = [
  "ศูนย์",
  "หนึ่ง",
  "สอง",
  "สาม",
  "สี่",
  "ห้า",
  "หก",
  "เจ็ด",
  "แปด",
  "เก้า",
  "สิบ",
  "สิบเอ็ด",
  "สิบสอง",
];
const digits = (text: string) => text.replace(/[๐-๙]/gu, (d) => String(d.charCodeAt(0) - 3664));
const numeral = (word: string) => (/^\d+$/.test(word) ? Number(word) : thaiNumbers.indexOf(word));

function clocksIn(quote: string) {
  const times = new Set<string>();
  const clockText = digits(quote);
  for (const [, h, m] of clockText.matchAll(/(?<![\d.])([01]?\d|2[0-3])[:.]([0-5]\d)(?!\d)/gu))
    times.add(h.padStart(2, "0") + ":" + m);
  for (const [, period, word, half] of clockText.matchAll(
    /(บ่าย|ตี)\s*(หนึ่ง|สอง|สาม|สี่|ห้า|หก|โมง|\d+)(?:โมง)?\s*(ครึ่ง)?/gu,
  )) {
    const n = word === "โมง" ? 1 : numeral(word);
    if (n >= 1 && n <= 6)
      times.add(String(n + (period === "บ่าย" ? 12 : 0)).padStart(2, "0") + (half ? ":30" : ":00"));
  }
  for (const [, word, half] of clockText.matchAll(/(?<![0-9:.])(\d{1,2})\s*(?:น\.|นาฬิกา|โมงเช้า)\s*(ครึ่ง)?/gu)) {
    if (Number(word) < 24) times.add(word.padStart(2, "0") + (half ? ":30" : ":00"));
  }
  return times;
}

function quantitiesIn(quote: string) {
  const values = new Set<number>();
  for (const [, word] of digits(quote).matchAll(
    /(?<![\d.,-])(\d+|หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ)\s*(?:หน่วย|ชิ้น|กล่อง|ลัง|แพ็ก|แพ็ค|ถุง|ขวด|units?\b|pieces?\b)/giu,
  ))
    values.add(numeral(word));
  return values;
}

const verb = {
  delay: /ล่าช้า|เลื่อน|ช้าลง|ช้า|ออกได้|พร้อม(?:ส่ง|หยิบ|ออก)|delayed|delay|ready at/iu,
  stock_found: /พบ|เจอ|หาได้|ของเพิ่ม|สต๊อกเพิ่ม|สต็อกเพิ่ม|stock found|found|extra stock/iu,
  resumed: /กลับมา|เปิด(?:ให้)?หยิบ|เริ่มหยิบได้|หยิบได้(?:แล้ว|ตามปกติ)|resumed|back (?:up|online)/iu,
};
const uncertain =
  /ไม่|มิได้|ห้าม|อาจจะ|หรือ|ถ้า|ไหม|มั้ย|สมมติ|(?:^|\s|ช่วย|กรุณา|โปรด)จอง|\b(?:book|reserve|maybe|might|if|no|not|or|never|don't|isn't)\b|\?/iu;
const anotherDay = /พรุ่งนี้|มะรืน|เมื่อวาน|วันที่\s*[๐-๙0-9]|\btomorrow\b|\byesterday\b|\b\d{1,4}[-/]\d{1,2}[-/]\d{1,4}\b/iu;

function warehouseIn(quote: string, snapshot: Snapshot) {
  const spoken: Record<string, string> = { A: "เอ", B: "บี", C: "ซี" };
  return snapshot.warehouses.filter(
    (w) =>
      mentionsItem(quote, w.id, w.name_th.replace(/^คลัง\s+\S+\s+/u, "")) ||
      new RegExp(
        "(?:คลัง|โกดัง|สาขา|ฝั่ง)\\s*" + spoken[w.id] + "(?=\\s|$|ออก|พบ|กลับ|เลื่อน|เจอ|พร้อม|หยิบ)",
        "u",
      ).test(quote),
  );
}

export function validateChat(
  raw: unknown,
  message: string,
  snapshot: Snapshot,
  context: ChatContext,
  applying = false,
): ValidatedInterpretation {
  checkMessage(message);
  const parsed = chatInterpretationSchema.safeParse(raw);
  if (!parsed.success) throw new InvalidOutputError();
  const { event_type, event_time, quantity, ...base } = parsed.data;
  if (base.kind !== "incident" || event_type === "outage") {
    if (base.kind === "incident" && (event_time !== null || quantity !== null)) return clarify("conflict", "V1");
    const checked = validate(base, message, snapshot);
    return checked.outcome === "incident" ? { ...checked, event_type: "outage" } : checked;
  }
  if (!event_type || base.window_start || base.window_end) return clarify("conflict", "V1");
  const quote = base.evidence_quote;
  if (!quote?.trim() || !message.includes(quote)) return clarify("other", "V5");
  if (anotherDay.test(message)) return clarify("time", "V4", c.needClock.th);
  if (
    !verb[event_type].test(quote) ||
    uncertain.test(message) ||
    Object.entries(verb).some(([kind, rule]) => kind !== event_type && rule.test(message))
  )
    return clarify("conflict", "V1");
  const locations = warehouseIn(message, snapshot);
  const warehouse = snapshot.warehouses.find((row) => row.id === base.warehouse?.trim().toUpperCase());
  if (!warehouse || locations.length !== 1 || warehouseIn(quote, snapshot)[0]?.id !== warehouse.id)
    return clarify("warehouse", "V2", c.needLocation.th);
  if (base.skus.length > 1) return clarify("sku", "V3", c.oneSku.th);
  const explicit = base.skus[0];
  const id =
    explicit ??
    (event_type !== "stock_found"
      ? (context.incident?.sku_id ?? (snapshot.skus.length === 1 ? snapshot.skus[0].id : undefined))
      : undefined);
  const sku = snapshot.skus.find((row) => row.id === id);
  const target = snapshot.stock.find((row) => row.warehouse_id === warehouse.id && row.sku_id === id);
  if (
    !sku ||
    !target ||
    (explicit && !mentionsItem(quote, sku.id, sku.name)) ||
    [...message.matchAll(/\bSKU[-_][\w-]+/giu)].some((match) => match[0].toLowerCase() !== sku.id.toLowerCase()) ||
    snapshot.skus.some((other) => other.id !== sku.id && mentionsItem(message, other.id, undefined)) ||
    (event_type === "stock_found" && !explicit)
  )
    return clarify("sku", "V3", c.needSku.th);
  const fields = { warehouse_id: warehouse.id, sku_id: sku.id };
  let event: WarehouseEvent;
  if (event_type === "stock_found") {
    const quantities = quantitiesIn(quote);
    const range = /(?:\d|หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ)\s*(?:ถึง|และ|กับ|[-–])\s*(?:\d|หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ)/u;
    if (
      event_time !== null ||
      quantity === null ||
      quantity < 1 ||
      quantity > 10000 ||
      range.test(digits(message)) ||
      quantities.size !== 1 ||
      quantitiesIn(message).size !== 1 ||
      !quantities.has(quantity)
    )
      return clarify("other", "V1", c.needCount.th);
    event = { type: event_type, ...fields, quantity };
  } else {
    const times = clocksIn(quote);
    if (
      quantity !== null ||
      !event_time ||
      times.size !== 1 ||
      clocksIn(message).size !== 1 ||
      !times.has(event_time)
    )
      return clarify("time", "V4", c.needClock.th);
    const at = bangkokTimestamp(snapshot.scenario.now_at.slice(0, 10), event_time);
    if (event_type === "delay") {
      if (!applying && Date.parse(at) <= Date.parse(target.ready_at)) return clarify("time", "V4", c.later.th);
      event = { type: event_type, ...fields, at };
    } else {
      const incident = context.incident;
      if (!incident || incident.warehouse_id !== warehouse.id || incident.sku_id !== sku.id)
        return clarify("conflict", "V1", c.whichOutage.th);
      if (at < incident.window_start || at >= incident.window_end) return clarify("time", "V4", c.whenResumed.th);
      event = {
        type: event_type,
        ...fields,
        at,
        window_start: incident.window_start,
        window_end: incident.window_end,
      };
    }
  }
  return {
    outcome: "event",
    event,
    evidence_quote: quote,
    incident: null,
    clarification: null,
    validation: { ok: true, issues: [] },
  };
}

// Rebuild the narrow report and repeat evidence checks at the write boundary. Replay can arrive after the time moved.
export function verifiedReport(input: ChatApply, snapshot: Snapshot) {
  const { event, message, chat, evidence_quote } = input;
  const statedSku = snapshot.skus.find((sku) => sku.id === event.sku_id);
  const raw: RawChatInterpretation = {
    kind: "incident",
    event_type: event.type,
    warehouse: event.warehouse_id,
    evidence_quote,
    skus: statedSku && mentionsItem(evidence_quote, statedSku.id, statedSku.name) ? [event.sku_id] : [],
    event_time: event.type !== "stock_found" ? event.at.slice(11, 16) : null,
    quantity: event.type === "stock_found" ? event.quantity : null,
    window_start: null,
    window_end: null,
    clarify_about: null,
    clarification_question: null,
  };
  const checked = validateChat(raw, message, snapshot, chat, true);
  return checked.outcome === "event" &&
    Object.entries(checked.event).every(([key, value]) => Reflect.get(event, key) === value)
    ? checked.event
    : null;
}
