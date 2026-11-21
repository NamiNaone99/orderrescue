import type { PlanRequest, PlanResponse, StateResponse } from "@/lib/domain/contracts";
import { formatThb } from "@/lib/domain/money";
import { formatBangkokTime, toEpochMs } from "@/lib/domain/time";
import { insightCopy as c } from "@/lib/copy";
import { sourceRows } from "@/lib/planner/candidates";

type Source = ReturnType<typeof sourceRows>[number];
type InsightPlan = PlanResponse & { effective_window_end?: string };
export function effectiveWindowEnd(plan: InsightPlan, incident: Pick<PlanRequest["incident"], "window_end">) {
  return plan.effective_window_end ?? incident.window_end;
}

export function insightSources(plan: InsightPlan, state: StateResponse, incident: PlanRequest["incident"]) {
  return sourceRows(state.stock, state.scenario.now_at, { ...incident, window_end: effectiveWindowEnd(plan, incident) });
}

type Reason = "chosen" | "missing" | "stock" | "late" | "budget" | "allocated" | "higherCost" | "tie" | "feasible";
export type SourceOption = {
  warehouse: string; reason: Reason; cost: bigint | null; ready: string | null;
  free: number; remaining: number; availableBudget: number; premium: bigint;
};

export function orderExplanations(plan: InsightPlan, state: StateResponse, incident: PlanRequest["incident"]) {
  const sources = insightSources(plan, state, incident);
  const byWarehouse = new Map(sources.map(source => [source.row.warehouse_id, source]));
  const assigned = new Map<string, number>();
  const selected = new Map(plan.joint.lines.map(line => [line.order_id, line]));
  for (const line of plan.joint.lines) assigned.set(line.warehouse_id, (assigned.get(line.warehouse_id) ?? 0) + line.qty);
  return plan.affected.map(order => {
    const choice = selected.get(order.order_id);
    // Evaluate a change for this order while retaining every other joint-plan allocation.
    const availableBudget = plan.budget_thb - plan.joint.extra_cost_thb + (choice ? choice.qty * choice.unit_cost_thb : 0);
    const options = state.warehouses.map(({ id: warehouse }): SourceOption => {
      const source = byWarehouse.get(warehouse);
      const chosen = choice?.warehouse_id === warehouse;
      const free = source?.free ?? 0;
      const remaining = free - (assigned.get(warehouse) ?? 0) + (chosen ? order.qty : 0);
      const cost = source ? BigInt(source.unitCost) * BigInt(order.qty) : null;
      const premium = choice && cost !== null ? cost - BigInt(choice.unit_cost_thb) * BigInt(choice.qty) : BigInt(0);
      let reason: Reason = "feasible";
      if (chosen) reason = "chosen";
      else if (!source) reason = "missing";
      else if (free < order.qty) reason = "stock";
      else if (source.readyMs > toEpochMs(order.deadline_at)) reason = "late";
      else if (remaining < order.qty) reason = "allocated";
      else if (cost !== null && cost > availableBudget) reason = "budget";
      else if (premium > 0) reason = "higherCost";
      else if (choice && premium === BigInt(0) && plan.solver.optimality === "proven") reason = "tie";
      return { warehouse, reason, cost, ready: source?.readyAt ?? null, free, remaining, availableBudget, premium };
    });
    return { order, chosen: choice?.warehouse_id, options };
  });
}

export function optionText(option: SourceOption): string {
  const values: Record<string, string> = {
    ready: option.ready ? formatBangkokTime(option.ready) : "",
    free: String(option.free), remaining: String(option.remaining), budget: formatThb(option.availableBudget),
    premium: "฿" + option.premium.toLocaleString("th-TH"),
  };
  return c[option.reason].th.replace(/\{(\w+)\}/g, (_, key: string) => values[key]);
}

// If every possible sum fits, these are all budgets where a feasible assignment can first appear.
// Ignoring competition here only adds redundant probes. The existing planning endpoint settles each one.
const maxProbes = 6;
export function frontierBudgets(plan: PlanResponse, sources: readonly Source[]) {
  let sums = new Set([0]);
  let exact = true;
  let ceiling = 0;
  for (const order of plan.affected) {
    const costs = sources.filter(row => row.free >= order.qty && row.readyMs <= toEpochMs(order.deadline_at))
      .map(row => row.unitCost * order.qty).filter(Number.isSafeInteger);
    ceiling = Math.min(Number.MAX_SAFE_INTEGER, ceiling + Math.max(0, ...costs));
    if (!exact) continue;
    const next = new Set(sums);
    for (const sum of sums) for (const cost of costs) {
      if (Number.isSafeInteger(sum + cost)) next.add(sum + cost);
    }
    if (next.size > maxProbes) exact = false;
    else sums = next;
  }
  if (!exact) {
    sums = new Set(Array.from({ length: maxProbes }, (_, i) => Math.round(ceiling * (i / (maxProbes - 1)))));
  }
  return { budgets: [...sums].sort((a, b) => a - b), exact };
}

export type BudgetPoint = { budget: number; onTime: number; proven: boolean };
export function observedBudget(plan: PlanResponse): BudgetPoint {
  return { budget: plan.budget_thb, onTime: plan.joint.on_time, proven: plan.solver.optimality === "proven" };
}

export function attainedSteps(points: BudgetPoint[]) {
  const steps: BudgetPoint[] = [];
  for (const point of points.toSorted((a, b) => a.budget - b.budget)) {
    if (!steps.length || point.onTime > steps[steps.length - 1].onTime) steps.push(point);
  }
  return steps;
}
