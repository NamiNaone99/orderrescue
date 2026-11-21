import { expect, it } from "vitest";
import { plan } from "@/lib/planner";
import { heroIncident, heroSnapshot } from "@/lib/scenarios/hero";

it.each([
  { budget: 88, count: 2, cost: 88, assignments: [["101", "B"], ["102", "C"]] },
  { budget: 87, count: 1, cost: 32, assignments: [["101", "B"]] },
  { budget: 31, count: 0, cost: 0, assignments: [] },
])("bounds the cost of the whole joint plan at THB $budget", ({ budget, count, cost, assignments }) => {
  const { joint } = plan(heroSnapshot, heroIncident, budget);
  expect(joint).toMatchObject({ on_time: count, total: 2, extra_cost_thb: cost });
  expect(joint.lines.map(line => [line.order_id, line.warehouse_id]).sort()).toEqual(assignments);
});
