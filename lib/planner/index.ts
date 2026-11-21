import type { PlanRequest } from "@/lib/domain/contracts";
import { isWholeBaht } from "@/lib/domain/money";
import type { PlanResult, Snapshot } from "@/lib/domain/types";
import { compareIds, findAffected } from "./affected";
import { prepareCandidates, type Candidate, type PlanningOrder } from "./candidates";
import { greedy } from "./firstCome";
import { solveJoint } from "./joint";

function summarize(orders: readonly PlanningOrder[], allocation: readonly Candidate[]): PlanResult["joint"] {
  const lines = allocation.map(choice => choice.line).sort((a, b) => compareIds(a.order_id, b.order_id));
  const served = new Set(lines.map(line => line.order_id));
  const needsHuman = orders.filter(order => !served.has(order.affected.order_id))
    .map(({ affected, reason }) => ({ order_id: affected.order_id, reason }))
    .sort((a, b) => compareIds(a.order_id, b.order_id));
  return {
    on_time: lines.length,
    total: orders.length,
    extra_cost_thb: allocation.reduce((total, choice) => total + choice.cost, 0),
    lines,
    needs_human: needsHuman,
  };
}

export function plan(
  snapshot: Snapshot, incident: PlanRequest["incident"], budget: number, nodeLimit?: number,
): PlanResult {
  if (!isWholeBaht(budget) || budget < 0) throw new RangeError("Budget must be a non-negative integer in THB");
  const affected = findAffected(snapshot, incident);
  const { orders, free } = prepareCandidates(snapshot, incident, affected, budget);
  const firstCome = greedy(orders, free, budget);
  const { allocation, solver } = solveJoint(orders, free, budget, firstCome, nodeLimit);
  return {
    affected: affected.map(order => order.affected),
    first_come: summarize(orders, firstCome),
    joint: summarize(orders, allocation),
    solver,
  };
}
