import { compareIds } from "./affected";
import type { Candidate, PlanningOrder } from "./candidates";

export interface Choice {
  order: PlanningOrder;
  candidate: Candidate;
}

function byAssignment(a: Choice, b: Choice): number {
  const left = a.candidate.line;
  const right = b.candidate.line;
  return compareIds(left.order_id, right.order_id) || compareIds(left.warehouse_id, right.warehouse_id);
}

function compareLists<T>(a: T[], b: T[], compare: (left: T, right: T) => number): number {
  for (let i = 0; i < a.length; i++) {
    const difference = compare(a[i], b[i]);
    if (difference !== 0) return difference;
  }
  return 0;
}

const ascending = (a: number, b: number) => a - b;

// Search prefixes are already ordered by deadline. Equal remaining budgets
// mean equal spent costs, so compare arrivals and IDs only on a deadline tie.
export function compareEqualCostPrefixes(a: Choice[], b: Choice[]): number {
  return b.length - a.length
    || compareLists(a, b, (left, right) => left.order.deadlineMs - right.order.deadlineMs)
    || compareLists(
      a.map(({ order }) => order.receivedMs).sort(ascending),
      b.map(({ order }) => order.receivedMs).sort(ascending),
      ascending,
    )
    || compareLists([...a].sort(byAssignment), [...b].sort(byAssignment), byAssignment);
}

// Minimizing each list independently gives an optimistic bound when only some
// of the optional orders fit. With no optional orders this is the exact score.
function lowest<T>(fixed: T[], optional: T[], count: number, compare: (a: T, b: T) => number): T[] {
  const selected = count === optional.length ? optional : optional.sort(compare).slice(0, count);
  return fixed.concat(selected).sort(compare);
}

export function objective(fixed: Choice[], optional: Choice[] = [], count = optional.length) {
  const costs = optional.map(({ candidate }) => candidate.cost);
  const selectedCosts = count === costs.length ? costs : costs.sort(ascending).slice(0, count);
  const spent = fixed.reduce((sum, { candidate }) => sum + candidate.cost, 0);
  return {
    deadlines: lowest(
      fixed.map(({ order }) => order.deadlineMs), optional.map(({ order }) => order.deadlineMs), count, ascending,
    ),
    cost: selectedCosts.reduce((sum, cost) => sum + cost, spent),
    arrivals: lowest(
      fixed.map(({ order }) => order.receivedMs), optional.map(({ order }) => order.receivedMs), count, ascending,
    ),
    assignments: lowest(fixed, [...optional], count, byAssignment),
  };
}

// A negative comparison means the left objective is preferred.
export function compareObjectives(a: ReturnType<typeof objective>, b: ReturnType<typeof objective>): number {
  return b.deadlines.length - a.deadlines.length
    || compareLists(a.deadlines, b.deadlines, ascending)
    || a.cost - b.cost
    || compareLists(a.arrivals, b.arrivals, ascending)
    || compareLists(a.assignments, b.assignments, byAssignment);
}
