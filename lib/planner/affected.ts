import type { PlanRequest } from "@/lib/domain/contracts";
import { toEpochMs } from "@/lib/domain/time";
import type { PlanResult, Snapshot } from "@/lib/domain/types";

export interface AffectedOrder {
  affected: PlanResult["affected"][number];
  receivedMs: number;
  deadlineMs: number;
}

export function compareIds(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/** Each order has at most one line for a given SKU. */
export function findAffected(snapshot: Snapshot, incident: PlanRequest["incident"]): AffectedOrder[] {
  const quantities = new Map<string, number>();
  for (const line of snapshot.order_lines) {
    if (line.sku_id === incident.sku_id) quantities.set(line.order_id, line.qty);
  }

  const orders: AffectedOrder[] = [];
  for (const order of snapshot.orders) {
    const qty = quantities.get(order.id);
    if (qty === undefined || order.status !== "open" || order.home_warehouse_id !== incident.warehouse_id) continue;
    orders.push({
      affected: { order_id: order.id, qty, received_at: order.received_at, deadline_at: order.deadline_at },
      receivedMs: toEpochMs(order.received_at),
      deadlineMs: toEpochMs(order.deadline_at),
    });
  }
  return orders.sort((a, b) =>
    a.receivedMs - b.receivedMs || a.deadlineMs - b.deadlineMs || compareIds(a.affected.order_id, b.affected.order_id),
  );
}
