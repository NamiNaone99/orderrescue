import { expect, it } from "vitest";
import { plan } from "@/lib/planner";
import { heroIncident, heroSnapshot } from "@/lib/scenarios/hero";
import { heroStockRow } from "./hero-stock";

it("allocates B's eight free units once, and cannot allocate an eight-unit line when only seven are free", () => {
  const snapshot = structuredClone(heroSnapshot);
  const before = plan(snapshot, heroIncident, 100);
  for (const strategy of [before.first_come, before.joint]) {
    const fromB = strategy.lines.filter(line => line.warehouse_id === "B");
    expect(fromB.map(line => line.qty)).toEqual([8]);
  }

  const stock = heroStockRow(snapshot, "B");
  stock.committed = 13;
  stock.revision++;
  const after = plan(snapshot, heroIncident, 100);
  for (const strategy of [after.first_come, after.joint]) {
    expect(strategy.lines).toMatchObject([{ order_id: "102", warehouse_id: "C", qty: 8 }]);
    expect(strategy.extra_cost_thb).toBe(56);
  }
});
