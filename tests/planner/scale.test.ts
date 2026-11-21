import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { plan } from "@/lib/planner";
import { heroIncident, heroSnapshot } from "@/lib/scenarios/hero";
import { realDaySnapshot } from "@/lib/scenarios/realDayFormat";
import { expectValidPlan, planningCase, type PlanningCase } from "@/tests/helpers/plannerCases";

function synthetic(size: number) {
  const orders = Array.from({ length: size }, (_, index) => ({
    qty: 1 + (index * 7 + 3) % 12,
    arrivalSlot: 16 + index % 9,
    deadlineSlot: 26 + (index * 5) % 14,
  }));
  const demand = orders.reduce((total, order) => total + order.qty, 0);
  const rows = [0.35, 0.25, 0.2].map((share, i) => ({
    free: Math.ceil(demand * share), committed: 5 + 3 * i,
    cost: [0, 4, 7][i], readySlot: [26, 27, 30][i],
  }));
  return planningCase(orders, rows, Math.min(300, size * 12));
}

function measure(label: string, value: PlanningCase, expectedCount: number) {
  const solve = () => plan(value.snapshot, value.incident, value.budget);
  const warm = solve();
  expect(warm.affected).toHaveLength(expectedCount);
  expectValidPlan(value, warm);
  const times: number[] = [];
  for (let run = 0; run < 5; run++) {
    const started = performance.now();
    const result = solve();
    const elapsed = performance.now() - started;
    expect(elapsed).toBeLessThan(2000);
    expect(result).toEqual(warm);
    times.push(elapsed);
  }
  times.sort((a, b) => a - b);
  console.info(`${label}: ${expectedCount} affected, ${warm.solver.nodes} nodes, ${warm.solver.optimality}, `
    + `first/joint ${warm.first_come.on_time}/${warm.joint.on_time}, median ${times[2].toFixed(2)} ms, max ${times[4].toFixed(2)} ms`);
}

it("times the documented two-order hero", () => {
  measure("hero", { snapshot: heroSnapshot, incident: heroIncident, budget: 100 }, 2);
});

it.each([8, 12, 25, 40])("returns a valid plan for %i synthetic orders and three warehouses", size => {
  measure("synthetic", synthetic(size), size);
});

const file = "data/derived/day-2011-11-22.json";
it.skipIf(!existsSync(file))("returns a valid plan for real-day SKU 23084 in under two seconds", () => {
  const snapshot = realDaySnapshot(JSON.parse(readFileSync(file, "utf8")));
  const incident = { ...heroIncident, sku_id: "23084" };
  measure("real-day", { snapshot, incident, budget: snapshot.scenario.default_budget_thb }, 21);
});
