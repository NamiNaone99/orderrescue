import type { PlanResponse, StateResponse } from "@/lib/domain/contracts";

export type PlanChange =
  | { kind: "report"; warehouse: string; sku: string }
  | { kind: "stock"; warehouse: string; sku: string; before: number; after: number | null; oldReady?: string; newReady?: string }
  | { kind: "order"; id: string; status: StateResponse["orders"][number]["status"] | null };

export function planChanges(plan: Pick<PlanResponse, "affected" | "first_come" | "joint" | "report_revisions">, baseline: StateResponse, latest: StateResponse): PlanChange[] {
  const changes: PlanChange[] = [];
  const key = (row: { warehouse_id: string; sku_id: string }) => row.warehouse_id + "/" + row.sku_id;
  const original = new Map(baseline.stock.map(row => [key(row), row]));
  const current = new Map(latest.stock.map(row => [key(row), row]));
  const used = new Map([...plan.first_come.lines, ...plan.joint.lines].map(line => [key(line), line]));
  for (const [id, line] of used) {
    const row = current.get(id);
    if (row?.revision === line.expected_revision) continue;
    const previous = original.get(id);
    changes.push({ kind: "stock", warehouse: line.warehouse_id, sku: line.sku_id, before: line.expected_revision,
      after: row?.revision ?? null, oldReady: previous?.revision === line.expected_revision ? previous.ready_at : undefined,
      newReady: row?.ready_at });
  }
  // An operator-confirmed report can make a previously unused source feasible, including a zero-line plan.
  const plannedReports = new Map(plan.report_revisions?.map(row => [key(row), row.revision]));
  for (const [id, row] of current) {
    const previous = original.get(id);
    if (used.has(id) || plannedReports.get(id) === row.report_revision) continue;
    // A report can land between POST /plan and the baseline GET. In that case the old revision is unknown.
    if (!previous || row.revision === previous.revision) {
      changes.push({ kind: "report", warehouse: row.warehouse_id, sku: row.sku_id });
      continue;
    }
    changes.push({ kind: "stock", warehouse: row.warehouse_id, sku: row.sku_id, before: previous.revision,
      after: row.revision, oldReady: previous.ready_at, newReady: row.ready_at });
  }
  // The planner includes only open orders, even when its joint allocation leaves them to a person.
  const statuses = new Map(latest.orders.map(order => [order.id, order.status]));
  for (const order of plan.affected) {
    const status = statuses.get(order.order_id);
    if (status !== "open") changes.push({ kind: "order", id: order.order_id, status: status ?? null });
  }
  return changes;
}
