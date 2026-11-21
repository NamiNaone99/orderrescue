import "server-only";
import { bangkokTimestamp } from "@/lib/domain/time";
import type { Incident, Snapshot } from "@/lib/domain/types";

export function heroTime(time: string) {
  return bangkokTimestamp("2026-11-21", time);
}

const incidentMessage = "คลัง A งดหยิบ SKU-X รอบบ่ายวันนี้";
const evidenceQuote = "งดหยิบ SKU-X รอบบ่ายวันนี้";

export const heroIncident: Incident = {
  warehouse_id: "A",
  sku_id: "SKU-X",
  window_start: heroTime("13:00"),
  window_end: heroTime("18:00"),
  evidence_quote: evidenceQuote,
  source_message: incidentMessage,
};

export const heroSampleMessages = [
  {
    text: incidentMessage,
    label_th: "งดหยิบรอบบ่าย",
    expected: {
      evidence_quote: evidenceQuote,
      kind: "incident",
      warehouse: "A",
      skus: ["SKU-X"],
      window_start: "13:00",
      window_end: "18:00",
      clarify_about: null,
      clarification_question: null,
    },
  },
  {
    text: "ของตัวนั้นหยิบไม่ได้นะบ่ายนี้",
    label_th: "ข้อมูลไม่ครบ",
    expected: {
      evidence_quote: null,
      kind: "clarification",
      warehouse: null,
      skus: [],
      window_start: null,
      window_end: null,
      clarify_about: "warehouse",
      clarification_question: "คลังไหนหยิบสินค้าไม่ได้คะ",
    },
  },
  {
    text: "พรุ่งนี้ใครเข้ากะเช้าบ้าง",
    label_th: "ถามเรื่องกะงาน",
    expected: {
      evidence_quote: null,
      kind: "ignore",
      warehouse: null,
      skus: [],
      window_start: null,
      window_end: null,
      clarify_about: null,
      clarification_question: null,
    },
  },
] as const;

const slipEventId = "b-slips-1430";

export const heroEventChanges = {
  [slipEventId]: {
    warehouse_id: "B",
    sku_id: "SKU-X",
    ready_at: heroTime("14:30"),
    revision_increment: 1,
  },
} as const;

export const heroSnapshot: Snapshot = {
  scenario: {
    id: "hero",
    name_th: "ตัวอย่างคลังงดหยิบรอบบ่าย",
    name_en: "Afternoon picking disruption",
    kind: "synthetic",
    now_at: heroTime("12:30"),
    default_budget_thb: 100,
    default_sku_id: "SKU-X",
    shifts: [
      { name_th: "รอบเช้า", start: "08:00", end: "12:00" },
      { name_th: "รอบบ่าย", start: "13:00", end: "18:00" },
    ],
    demo_events: [{
      id: slipEventId,
      label_th: "คลัง B แจ้งของพร้อมช้าเป็น 14:30",
      label_en: "Warehouse B ready time slips to 14:30",
      applied: false,
    }],
    sample_messages: heroSampleMessages.map(({ text, label_th }) => ({ text, label_th })),
  },
  warehouses: [
    { id: "A", name_th: "คลัง A บางนา", is_home: true },
    { id: "B", name_th: "คลัง B ลาดกระบัง", is_home: false },
    { id: "C", name_th: "คลัง C รังสิต", is_home: false },
  ],
  skus: [{ id: "SKU-X", name: "น้ำดื่ม 600 มล. แพ็ก 12" }],
  stock: [
    {
      warehouse_id: "A", sku_id: "SKU-X", on_hand: 24, committed: 8,
      ready_at: heroTime("13:00"), extra_cost_per_unit_thb: 0, revision: 1,
    },
    {
      warehouse_id: "B", sku_id: "SKU-X", on_hand: 20, committed: 12,
      ready_at: heroTime("13:30"), extra_cost_per_unit_thb: 4, revision: 1,
    },
    {
      warehouse_id: "C", sku_id: "SKU-X", on_hand: 8, committed: 0,
      ready_at: heroTime("15:00"), extra_cost_per_unit_thb: 7, revision: 1,
    },
  ],
  orders: [
    {
      id: "102", received_at: heroTime("09:10"), deadline_at: heroTime("16:00"),
      home_warehouse_id: "A", customer_ref: null, status: "open",
    },
    {
      id: "101", received_at: heroTime("09:40"), deadline_at: heroTime("14:00"),
      home_warehouse_id: "A", customer_ref: null, status: "open",
    },
  ],
  order_lines: [
    { order_id: "102", sku_id: "SKU-X", qty: 8 },
    { order_id: "101", sku_id: "SKU-X", qty: 8 },
  ],
  reservations: [],
};
