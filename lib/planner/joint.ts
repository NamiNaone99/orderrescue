import type { PlanResult } from "@/lib/domain/types";
import { compareIds } from "./affected";
import type { Candidate, PlanningOrder } from "./candidates";
import { greedy } from "./firstCome";
import { type Choice, compareEqualCostPrefixes, compareObjectives, objective } from "./objective";

const defaultNodeLimit = 200_000;

function fitCount(sortedAmounts: number[], available: number): number {
  let count = 0;
  for (const amount of sortedAmounts) {
    if (amount > available) break;
    available -= amount;
    count++;
  }
  return count;
}

export function solveJoint(
  orders: readonly PlanningOrder[],
  free: readonly number[],
  budget: number,
  baseline: readonly Candidate[],
  nodeLimit = defaultNodeLimit,
): { allocation: Candidate[]; solver: PlanResult["solver"] } {
  if (!Number.isSafeInteger(nodeLimit) || nodeLimit < 0) {
    throw new RangeError("The search node limit must be a non-negative safe integer");
  }
  const ordered = [...orders].sort((a, b) =>
    a.deadlineMs - b.deadlineMs || a.receivedMs - b.receivedMs || compareIds(a.affected.order_id, b.affected.order_id),
  );
  const options = ordered.map(order => order.candidates.map(candidate => ({ order, candidate })).sort((a, b) =>
    a.candidate.cost - b.candidate.cost || compareIds(a.candidate.line.warehouse_id, b.candidate.line.warehouse_id),
  ));
  // In each suffix, a row can serve at most as many orders as its smallest
  // quantities permit. Counting an order at several rows only relaxes this bound.
  const quantitiesByRow = ordered.map((_, index) => free.map((_, row) => ordered.slice(index)
    .filter(order => order.candidates.some(candidate => candidate.rowIndex === row))
    .map(order => order.affected.qty)
    .sort((a, b) => a - b)));

  function seed(allocation: readonly Candidate[]): Choice[] {
    const byOrder = new Map(allocation.map(candidate => [candidate.line.order_id, candidate]));
    return ordered.flatMap(order => {
      const candidate = byOrder.get(order.affected.order_id);
      return candidate ? [{ order, candidate }] : [];
    });
  }

  let best = objective(seed(baseline));
  function consider(choices: Choice[]) {
    if (choices.length < best.assignments.length) return;
    const score = objective(choices);
    if (compareObjectives(score, best) < 0) best = score;
  }
  consider(seed(greedy(ordered, free, budget)));

  const chosen: Choice[] = [];
  const stock = [...free];
  // Large stock ranges rarely revisit the same stock vector within the search
  // budget. Cache prefixes where the depth-by-stock state space is compact.
  const stockStates = (quantitiesByRow[0] ?? []).reduce((states, quantities, row) => {
    const demand = quantities.reduce((sum, qty) => sum + qty, 0);
    return states * (1 + Math.min(demand, free[row]));
  }, ordered.length);
  const prefixes = stockStates <= defaultNodeLimit ? ordered.map(() => new Map<string, Choice[]>()) : undefined;
  let nodes = 0;
  let truncated = false;

  function dominated(index: number, remainingBudget: number): boolean {
    if (!prefixes) return false;
    // Identical resources at this depth permit exactly the same completions.
    // Adding a common suffix preserves the lexicographic order of the two prefixes.
    const key = `${remainingBudget}|${stock.join(",")}`;
    const previous = prefixes[index].get(key);
    if (previous && compareEqualCostPrefixes(previous, chosen) <= 0) return true;
    prefixes[index].set(key, [...chosen]);
    return false;
  }

  function canImprove(index: number, remainingBudget: number): boolean {
    const needed = best.assignments.length - chosen.length;
    if (ordered.length - index < needed) return false;
    const possible: Choice[] = [];
    let cheapestTotal = 0;
    for (let i = index; i < ordered.length; i++) {
      // Each order is considered alone against the residual stock and budget.
      // Warehouse ID breaks equal-cost ties to give the best possible fifth level.
      const cheapest = options[i].find(({ candidate }) =>
        candidate.cost <= remainingBudget && candidate.line.qty <= stock[candidate.rowIndex],
      );
      if (cheapest) {
        possible.push(cheapest);
        cheapestTotal += cheapest.candidate.cost;
      }
    }
    if (possible.length < needed) return false;
    const stockCount = quantitiesByRow[index].reduce((sum, quantities, row) =>
      sum + fitCount(quantities, stock[row]), 0);
    let upper = Math.min(possible.length, stockCount);
    if (cheapestTotal > remainingBudget && upper >= needed) {
      const costs = possible.map(({ candidate }) => candidate.cost).sort((a, b) => a - b);
      upper = Math.min(upper, fitCount(costs, remainingBudget));
    }
    if (upper !== needed) return upper > needed;
    return compareObjectives(objective(chosen, possible, needed), best) < 0;
  }

  function search(index: number, remainingBudget: number): void {
    if (nodes === nodeLimit) {
      truncated = true;
      return;
    }
    nodes++;
    if (index === ordered.length || nodes === nodeLimit) consider(chosen);
    if (index === ordered.length || dominated(index, remainingBudget) || !canImprove(index, remainingBudget)) return;

    for (const choice of options[index]) {
      const { cost, line, rowIndex } = choice.candidate;
      if (cost > remainingBudget || line.qty > stock[rowIndex]) continue;
      stock[rowIndex] -= line.qty;
      chosen.push(choice);
      search(index + 1, remainingBudget - cost);
      chosen.pop();
      stock[rowIndex] += line.qty;
      if (truncated) return;
    }
    search(index + 1, remainingBudget);
  }

  search(0, budget);
  return {
    allocation: best.assignments.map(({ candidate }) => candidate),
    solver: {
      mode: "branch_and_bound",
      optimality: truncated ? "best_found" : "proven",
      nodes,
      node_limit: nodeLimit,
    },
  };
}
