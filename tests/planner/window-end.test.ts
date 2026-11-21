import { expect, it } from "vitest";
import { plan } from "@/lib/planner";
import { heroIncident, heroSnapshot, heroTime } from "@/lib/scenarios/hero";
import { heroLateOrder, heroLateOrderExpected } from "@/tests/fixtures/hero-late-order";
import { heroStockRow } from "./hero-stock";

it.each(["19:00", "17:59"] as const)("honours the incident end with #103 due at %s", deadline => {
  const { joint } = plan(heroLateOrder(deadline), heroIncident, 100);
  const expected = heroLateOrderExpected[deadline].joint;
  expect(joint).toMatchObject({
    ...expected,
    lines: expect.arrayContaining(expected.lines.map(line => expect.objectContaining(line))),
  });
  expect(joint.lines).toHaveLength(expected.lines.length);
});

it("can use the origin before the incident starts, even when the ready time is before now", () => {
  const snapshot = structuredClone(heroSnapshot);
  heroStockRow(snapshot, "A").ready_at = heroTime("09:40");
  const { first_come, joint } = plan(snapshot, heroIncident, 0);
  for (const strategy of [first_come, joint]) {
    expect(strategy).toMatchObject({ on_time: 2, total: 2, extra_cost_thb: 0 });
    expect(strategy.lines).toHaveLength(2);
    for (const line of strategy.lines) {
      expect(line).toMatchObject({ warehouse_id: "A", ready_at: heroTime("12:30") });
    }
  }
});

it("can serve an order due exactly when the origin reopens", () => {
  const snapshot = heroLateOrder();
  for (const order of snapshot.orders) {
    if (order.id === "103") order.deadline_at = heroIncident.window_end;
  }
  const { joint } = plan(snapshot, heroIncident, 100);
  expect(joint.on_time).toBe(3);
  expect(joint.lines.find(line => line.order_id === "103")).toMatchObject({
    warehouse_id: "A", ready_at: heroTime("18:00"), deadline_at: heroTime("18:00"), unit_cost_thb: 0,
  });
});
