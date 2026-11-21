import { expect, it } from "vitest";
import { plan } from "@/lib/planner";
import { heroIncident, heroSnapshot, heroTime } from "@/lib/scenarios/hero";
import { heroTie, heroTieExpected, heroTieSwappedExpected } from "@/tests/fixtures/hero-tie";
import { heroStockRow } from "./hero-stock";

it("serves the cheaper of two equal-deadline orders independently of its ID", () => {
  expect(plan(heroTie(), heroIncident, 100)).toMatchObject(heroTieExpected);
  expect(plan(heroTie(true), heroIncident, 100)).toMatchObject(heroTieSwappedExpected);
});

it("prefers the earlier deadline even if it costs more, including pickup exactly at the deadline", () => {
  const snapshot = heroTie(true);
  for (const order of snapshot.orders) {
    order.received_at = heroTime("09:00");
    if (order.id === "202") order.deadline_at = heroTime("13:30");
  }
  const { first_come, joint } = plan(snapshot, heroIncident, 100);
  for (const strategy of [first_come, joint]) {
    expect(strategy).toMatchObject({
      on_time: 1, extra_cost_thb: 32, lines: [{ order_id: "202", warehouse_id: "B" }],
    });
  }
});

it("uses arrival time before ID and uses ID only after count, deadlines, cost and arrivals tie", () => {
  const snapshot = heroTie(true);
  for (const line of snapshot.order_lines) line.qty = 8;
  expect(plan(snapshot, heroIncident, 100).joint.lines).toMatchObject([{ order_id: "202" }]);

  for (const order of snapshot.orders) order.received_at = heroTime("09:00");
  const { first_come, joint } = plan(snapshot, heroIncident, 100);
  expect(joint.lines).toMatchObject([{ order_id: "201" }]);
  expect(first_come.lines).toMatchObject([{ order_id: "201" }]);
});

it("breaks first-come source ties by ready time then warehouse ID", () => {
  const snapshot = structuredClone(heroSnapshot);
  snapshot.orders = snapshot.orders.filter(order => order.id === "102");
  snapshot.order_lines = snapshot.order_lines.filter(line => line.order_id === "102");
  const b = heroStockRow(snapshot, "B");
  const c = heroStockRow(snapshot, "C");
  c.extra_cost_per_unit_thb = b.extra_cost_per_unit_thb;
  c.ready_at = heroTime("13:00");
  const differentReadyTimes = plan(snapshot, heroIncident, 100);
  expect(differentReadyTimes.first_come.lines).toMatchObject([{ warehouse_id: "C" }]);
  expect(differentReadyTimes.joint.lines).toMatchObject([{ warehouse_id: "B" }]);
  c.ready_at = b.ready_at;
  const { first_come, joint } = plan(snapshot, heroIncident, 100);
  expect(first_come.lines).toMatchObject([{ warehouse_id: "B" }]);
  expect(joint.lines).toMatchObject([{ warehouse_id: "B" }]);
});
