import { createHash } from "node:crypto";
import type { PlanRequest, ReservationRequest } from "@/lib/domain/contracts";
import { compareIds } from "./affected";

export function planHash(
  scenario: PlanRequest["scenario"],
  incident: PlanRequest["incident"],
  budget_thb: number,
  lines: ReadonlyArray<ReservationRequest["lines"][number]>,
): string {
  // Build fresh objects so field order and extra display fields from the UI cannot affect the digest.
  const canonicalLines = lines
    .map(({ order_id, sku_id, warehouse_id, qty, unit_cost_thb, expected_revision }) => ({
      order_id, sku_id, warehouse_id, qty, unit_cost_thb, expected_revision,
    }))
    .sort((left, right) => compareIds(left.order_id, right.order_id));
  const payload = {
    scenario,
    incident: {
      warehouse_id: incident.warehouse_id,
      sku_id: incident.sku_id,
      window_start: incident.window_start,
      window_end: incident.window_end,
    },
    budget_thb,
    lines: canonicalLines,
  };
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
}
