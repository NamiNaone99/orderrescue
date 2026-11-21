import { z } from "zod";
import { orderStatusSchema, scenarioSchema, skuSchema, stockRowSchema, warehouseIdSchema, warehouseSchema } from "@/lib/domain/contracts";
import { isBangkokTimestamp } from "@/lib/domain/time";
import type { Snapshot } from "@/lib/domain/types";

export const realDaySamples = [
  {
    text: "คลัง A งดหยิบ 23084 วันนี้ 13:00-18:00 ค่ะ ชั้นวางพัง", label_th: "ชั้นวางพัง",
    expected: {
      kind: "incident", warehouse: "A", skus: ["23084"], window_start: "13:00", window_end: "18:00",
      evidence_quote: "งดหยิบ 23084 วันนี้ 13:00-18:00", clarify_about: null, clarification_question: null,
    },
  },
  {
    text: "คลัง A 23084 กับ 23355 หยิบไม่ได้ 14.00-16.00", label_th: "สินค้าสองรายการ",
    expected: {
      kind: "incident", warehouse: "A", skus: ["23084", "23355"], window_start: "14:00", window_end: "16:00",
      evidence_quote: "23084 กับ 23355 หยิบไม่ได้ 14.00-16.00", clarify_about: null, clarification_question: null,
    },
  },
] as const;

const timestamp = z.string().refine(isBangkokTimestamp);
const order = z.object({
  id: z.string().min(1), customer_ref: z.string().regex(/^C\d{3,}$/), received_at: timestamp,
  deadline_at: timestamp, home_warehouse_id: warehouseIdSchema, status: orderStatusSchema,
  lines: z.array(z.object({ sku_id: z.string().min(1), qty: z.int().positive() })).min(1),
});

const daySchema = z.object({
  scenario: scenarioSchema, warehouses: z.array(warehouseSchema), skus: z.array(skuSchema),
  stock: z.array(stockRowSchema), orders: z.array(order),
});

// The derived file retains GBP prices and country solely for provenance.
export function realDaySnapshot(input: unknown): Snapshot {
  const { orders, ...day } = daySchema.parse(input);
  const orderLines: Snapshot["order_lines"] = [];
  const normalizedOrders = orders.map(({ lines, ...item }) => {
    for (const line of lines) orderLines.push({ order_id: item.id, ...line });
    return item;
  });
  return {
    ...day, orders: normalizedOrders, order_lines: orderLines, reservations: [],
  };
}
