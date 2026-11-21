import { fc, test } from "@fast-check/vitest";
import { afterAll, describe, expect } from "vitest";
import { plan } from "@/lib/planner";
import { planHash } from "@/lib/planner/hash";
import { heroIncident, heroSnapshot } from "@/lib/scenarios/hero";
import { bruteForce } from "@/tests/helpers/bruteForce";
import { expectValidPlan, planningCase, type Demand, type Supply } from "@/tests/helpers/plannerCases";

const seed = Number(process.env.PLANNER_TEST_SEED ?? 20261121);
const runs = { numRuns: 200, seed };
const integer = (min: number, max: number) => fc.integer({ min, max });
const demand = fc.record({ qty: integer(1, 12), arrivalSlot: integer(16, 24), deadlineSlot: integer(25, 40) });
const supply = fc.record({ free: integer(0, 30), committed: integer(0, 12), cost: integer(0, 9), readySlot: integer(22, 38) });

function cases(minOrders: number, maxOrders: number, maxWarehouses: number) {
  return fc.record({
    demand: integer(minOrders, maxOrders).chain(n => fc.array(demand, { minLength: n, maxLength: n })),
    supply: fc.array(supply, { minLength: 2, maxLength: maxWarehouses }),
    budget: integer(0, 300), home: integer(0, 2),
  });
}
type Generated = { demand: Demand[]; supply: Supply[]; budget: number; home: number };

function makeCase(input: Generated) {
  return planningCase(input.demand, input.supply, input.budget, input.home);
}

function agreesWithOracle(input: Generated) {
  const { snapshot, incident, budget } = makeCase(input);
  const optimal = bruteForce(snapshot, incident, budget);
  const { joint, solver } = plan(snapshot, incident, budget);
  expect(solver.optimality).toBe("proven");
  // The exact (order, warehouse) pairs identify the selected deadline and arrival multisets too.
  expect({
    onTime: joint.on_time, cost: joint.extra_cost_thb,
    assignments: joint.lines.map(line => [line.order_id, line.warehouse_id]),
  }).toEqual(optimal);
}

describe("exhaustive five-level oracle (AC-11)", { timeout: 60000 }, () => {
  test("reproduces the specified hero optimum and budget boundary", () => {
    expect(bruteForce(heroSnapshot, heroIncident, 100)).toEqual({
      onTime: 2, cost: 88, assignments: [["101", "B"], ["102", "C"]],
    });
    expect(bruteForce(heroSnapshot, heroIncident, 87)).toEqual({
      onTime: 1, cost: 32, assignments: [["101", "B"]],
    });
  });
  test.prop([cases(1, 6, 3)], runs)("matches the optimum for one to six orders", agreesWithOracle);
  test.prop([cases(7, 8, 3)], { ...runs, numRuns: 20 })("matches the optimum for seven or eight orders", agreesWithOracle);
});

const ordinary = cases(1, 12, 4);
test.prop([ordinary], runs)("honours stock, budget, one-source, time and baseline constraints for both strategies", input => {
  const value = makeCase(input);
  expectValidPlan(value, plan(value.snapshot, value.incident, value.budget));
});

const permutation = <T,>(items: T[]) => fc.shuffledSubarray(items, { minLength: items.length });
const shuffled = ordinary.chain(input => {
  const original = makeCase(input);
  const { orders, order_lines, stock, warehouses } = original.snapshot;
  return fc.record({
    orders: permutation(orders), order_lines: permutation(order_lines),
    stock: permutation(stock), warehouses: permutation(warehouses),
  }).map(arrays => ({ original, permuted: { ...original.snapshot, ...arrays } }));
});
test.prop([shuffled], runs)("preserves the complete serialized plan and hash under independent permutations", ({ original, permuted }) => {
  const { snapshot, incident, budget } = original;
  const first = plan(snapshot, incident, budget);
  const second = plan(permuted, incident, budget);
  expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  expect(planHash(snapshot.scenario.id, incident, budget, second.joint.lines))
    .toBe(planHash(snapshot.scenario.id, incident, budget, first.joint.lines));
});

test.prop([ordinary, integer(0, 299)], runs)("raising the budget cannot lower a proven on-time count", (input, otherBudget) => {
  const { snapshot, incident, budget } = makeCase(input);
  // Select two distinct budgets in 0..300, including the boundary values.
  const other = otherBudget >= budget ? otherBudget + 1 : otherBudget;
  const low = plan(snapshot, incident, Math.min(budget, other));
  const high = plan(snapshot, incident, Math.max(budget, other));
  fc.pre(low.solver.optimality === "proven" && high.solver.optimality === "proven");
  expect(high.joint.on_time).toBeGreaterThanOrEqual(low.joint.on_time);
});

describe("generated scale (AC-12)", { timeout: 120000 }, () => {
  const cappedSizes: number[] = [];
  let slowestMs = 0;
  afterAll(() => {
    console.info("Generated scale, largest observed latency:", slowestMs.toFixed(2), "ms; affected counts at node cap:", cappedSizes);
  });
  test.prop([cases(1, 40, 4)], runs)("returns a valid labelled allocation within the node and time limits", input => {
    const value = makeCase(input);
    const start = performance.now();
    const result = plan(value.snapshot, value.incident, value.budget);
    const elapsed = performance.now() - start;
    if (result.solver.optimality === "best_found") cappedSizes.push(input.demand.length);
    slowestMs = Math.max(slowestMs, elapsed);
    expectValidPlan(value, result);
    expect(elapsed).toBeLessThan(2000);
  });
});
