import { expect, it } from "vitest";
import { plan } from "@/lib/planner";
import { heroIncident, heroSnapshot, heroTime } from "@/lib/scenarios/hero";
import { heroLateOrder } from "@/tests/fixtures/hero-late-order";

it("serves #102 first in arrival order, and serves both hero orders jointly", () => {
  const result = plan(heroSnapshot, heroIncident, 100);
  const firstLine = {
    order_id: "102", sku_id: "SKU-X", warehouse_id: "B", qty: 8, unit_cost_thb: 4,
    ready_at: heroTime("13:30"), deadline_at: heroTime("16:00"), expected_revision: 1,
  };
  expect(result.first_come).toEqual({
    on_time: 1, total: 2, extra_cost_thb: 32, lines: [firstLine],
    needs_human: [{ order_id: "101", reason: "NOT_SELECTED" }],
  });
  expect(result.joint).toEqual({
    on_time: 2, total: 2, extra_cost_thb: 88,
    lines: expect.arrayContaining([
      { ...firstLine, order_id: "101", deadline_at: heroTime("14:00") },
      { ...firstLine, warehouse_id: "C", ready_at: heroTime("15:00"), unit_cost_thb: 7 },
    ]),
    needs_human: [],
  });
  expect(result.joint.lines).toHaveLength(2);
  expect(result.solver).toMatchObject({ mode: "branch_and_bound", optimality: "proven", node_limit: 200_000 });
});

it("includes only open orders at the incident warehouse that contain the incident SKU", () => {
  const snapshot = heroLateOrder();
  for (const order of snapshot.orders) {
    if (order.id === "101") order.status = "reserved";
    if (order.id === "102") order.home_warehouse_id = "B";
  }
  const affected = plan(snapshot, heroIncident, 100).affected;
  expect(affected).toEqual([{
    order_id: "103", qty: 4, received_at: heroTime("10:00"), deadline_at: heroTime("19:00"),
  }]);

  snapshot.skus.push({ id: "23084", name: "23084" });
  for (const line of snapshot.order_lines) {
    if (line.order_id === "103") line.sku_id = "23084";
  }
  const empty = plan(snapshot, heroIncident, 100);
  expect(empty.affected).toEqual([]);
  for (const strategy of [empty.first_come, empty.joint]) {
    expect(strategy).toEqual({ on_time: 0, total: 0, extra_cost_thb: 0, lines: [], needs_human: [] });
  }
});
