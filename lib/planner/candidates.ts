import type { PlanRequest } from "@/lib/domain/contracts";
import { toEpochMs } from "@/lib/domain/time";
import type { PlanLine, PlanResult, Snapshot } from "@/lib/domain/types";
import { compareIds, type AffectedOrder } from "./affected";

export interface Candidate {
  line: PlanLine;
  cost: number;
  rowIndex: number;
}

export interface PlanningOrder extends AffectedOrder {
  candidates: Candidate[];
  reason: PlanResult["joint"]["needs_human"][number]["reason"];
}

function unservedReason(hasStock: boolean, hasOnTimeSource: boolean, hasAffordableSource: boolean): PlanningOrder["reason"] {
  if (!hasStock) return "NO_STOCK";
  if (!hasOnTimeSource) return "NO_ON_TIME_SOURCE";
  return hasAffordableSource ? "NOT_SELECTED" : "OVER_BUDGET";
}

export function prepareCandidates(
  snapshot: Snapshot, incident: PlanRequest["incident"], affected: readonly AffectedOrder[], budget: number,
) {
  const now = snapshot.scenario.now_at;
  const nowMs = toEpochMs(now);
  const start = toEpochMs(incident.window_start);
  const end = toEpochMs(incident.window_end);
  const rows = snapshot.stock.filter(row => row.sku_id === incident.sku_id).map(row => {
    const rowMs = toEpochMs(row.ready_at);
    let readyMs = Math.max(nowMs, rowMs);
    let readyAt = rowMs >= nowMs ? row.ready_at : now;
    if (row.warehouse_id === incident.warehouse_id && start <= readyMs && readyMs < end) {
      readyMs = end;
      readyAt = incident.window_end;
    }
    return {
      row, free: row.on_hand - row.committed, readyAt, readyMs,
      unitCost: row.warehouse_id === incident.warehouse_id ? 0 : row.extra_cost_per_unit_thb,
    };
  });
  // Stable sorting by cost below preserves this tie-break for both greedy passes.
  rows.sort((a, b) => a.readyMs - b.readyMs || compareIds(a.row.warehouse_id, b.row.warehouse_id));

  const orders = affected.map((order): PlanningOrder => {
    const { order_id, qty, deadline_at } = order.affected;
    const candidates: Candidate[] = [];
    let hasStock = false;
    let hasOnTimeSource = false;
    for (const [rowIndex, { row, free, unitCost, readyAt, readyMs }] of rows.entries()) {
      if (qty > free) continue;
      hasStock = true;
      if (readyMs > order.deadlineMs) continue;
      hasOnTimeSource = true;
      // The budget is a safe integer. Products above that range can never be allocated.
      const cost = qty * unitCost;
      if (cost > budget) continue;
      candidates.push({
        line: {
          order_id, sku_id: row.sku_id, warehouse_id: row.warehouse_id, qty,
          unit_cost_thb: unitCost, ready_at: readyAt, deadline_at, expected_revision: row.revision,
        },
        rowIndex, cost,
      });
    }
    candidates.sort((a, b) => a.cost - b.cost);
    return { ...order, candidates, reason: unservedReason(hasStock, hasOnTimeSource, candidates.length > 0) };
  });
  return { orders, free: rows.map(row => row.free) };
}
