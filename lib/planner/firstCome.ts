import type { Candidate, PlanningOrder } from "./candidates";

/** Used in arrival order for the baseline and deadline order for the search seed. */
export function greedy(orders: readonly PlanningOrder[], free: readonly number[], budget: number): Candidate[] {
  const remaining = [...free];
  const selected: Candidate[] = [];
  for (const order of orders) {
    const choice = order.candidates.find(({ rowIndex, line, cost }) => line.qty <= remaining[rowIndex] && cost <= budget);
    if (choice) {
      remaining[choice.rowIndex] -= choice.line.qty;
      budget -= choice.cost;
      selected.push(choice);
    }
  }
  return selected;
}
