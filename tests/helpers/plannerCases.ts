import { expect } from "vitest";
import type { PlanRequest } from "@/lib/domain/contracts";
import type { PlanResult, Snapshot, Warehouse } from "@/lib/domain/types";
import { heroIncident, heroSnapshot, heroTime } from "@/lib/scenarios/hero";

export interface PlanningCase {
  snapshot: Snapshot;
  incident: PlanRequest["incident"];
  budget: number;
}

export interface Demand {
  qty: number;
  arrivalSlot: number;
  deadlineSlot: number;
}

export interface Supply {
  free: number;
  committed: number;
  cost: number;
  readySlot: number;
}

// TEST_PLAN §3 requests four locations in pure-solver stress tests. Public contracts allow A/B/C.
const locations: Warehouse["id"][] = ["A", "B", "C", "D" as Warehouse["id"]];

function halfHour(slot: number) {
  return heroTime(String(Math.floor(slot / 2)).padStart(2, "0") + (slot % 2 ? ":30" : ":00"));
}

export function planningCase(demand: Demand[], supply: Supply[], budget: number, homeIndex = 0): PlanningCase {
  const home = locations[homeIndex % Math.min(supply.length, 3)];
  const incident = { ...heroIncident, warehouse_id: home };
  const snapshot: Snapshot = {
    ...heroSnapshot,
    warehouses: supply.map((_, i) => ({ id: locations[i], name_th: locations[i], is_home: locations[i] === home })),
    stock: supply.map((row, i) => ({
      warehouse_id: locations[i], sku_id: incident.sku_id, on_hand: row.free + row.committed, committed: row.committed,
      ready_at: halfHour(row.readySlot), extra_cost_per_unit_thb: row.cost, revision: i + 1,
    })),
    orders: demand.map((order, i) => ({
      id: String(i + 1), received_at: halfHour(order.arrivalSlot), deadline_at: halfHour(order.deadlineSlot),
      home_warehouse_id: home, status: "open", customer_ref: null,
    })),
    order_lines: demand.map((order, i) => ({ order_id: String(i + 1), sku_id: incident.sku_id, qty: order.qty })),
  };
  return { snapshot, incident, budget };
}

export function expectValidPlan({ snapshot, incident, budget }: PlanningCase, result: PlanResult) {
  const orders = new Map(snapshot.orders.map(order => [order.id, order]));
  const demand = new Map(snapshot.order_lines.filter(line => line.sku_id === incident.sku_id)
    .map(line => [line.order_id, line.qty]));
  const affected = snapshot.orders.filter(order => order.status === "open"
    && order.home_warehouse_id === incident.warehouse_id && demand.has(order.id)).map(order => order.id).sort();
  const stock = snapshot.stock.filter(row => row.sku_id === incident.sku_id);
  expect(result.affected.map(row => row.order_id).sort()).toEqual(affected);
  expect(result.joint.on_time).toBeGreaterThanOrEqual(result.first_come.on_time);
  expect(result.solver.node_limit).toBe(200_000);
  expect(result.solver.nodes).toBeGreaterThan(0);
  expect(result.solver.nodes).toBeLessThanOrEqual(result.solver.node_limit);
  expect(["proven", "best_found"]).toContain(result.solver.optimality);
  if (result.solver.optimality === "best_found") expect(result.solver.nodes).toBe(result.solver.node_limit);

  for (const strategy of [result.first_come, result.joint]) {
    const partition = [...strategy.lines, ...strategy.needs_human].map(line => line.order_id).sort();
    expect(partition).toEqual(affected);
    expect(strategy.total).toBe(affected.length);
    expect(strategy.on_time).toBe(strategy.lines.length);
    const used = new Map<string, number>();
    let cost = 0;
    for (const line of strategy.lines) {
      const row = stock.find(row => row.warehouse_id === line.warehouse_id);
      const order = orders.get(line.order_id);
      if (!row || !order) throw new Error("Unknown stock row or order in allocation");
      const home = order.home_warehouse_id === row.warehouse_id;
      const clock = Math.max(Date.parse(snapshot.scenario.now_at), Date.parse(row.ready_at));
      const start = Date.parse(incident.window_start);
      const end = Date.parse(incident.window_end);
      const ready = home && start <= clock && clock < end ? end : clock;
      expect(line).toMatchObject({
        sku_id: incident.sku_id, qty: demand.get(order.id), unit_cost_thb: home ? 0 : row.extra_cost_per_unit_thb,
        deadline_at: order.deadline_at, expected_revision: row.revision,
      });
      expect(Date.parse(line.ready_at)).toBe(ready);
      expect(ready).toBeLessThanOrEqual(Date.parse(order.deadline_at));
      cost += line.qty * line.unit_cost_thb;
      used.set(row.warehouse_id, (used.get(row.warehouse_id) ?? 0) + line.qty);
    }
    for (const row of stock) expect(used.get(row.warehouse_id) ?? 0).toBeLessThanOrEqual(row.on_hand - row.committed);
    expect(strategy.extra_cost_thb).toBe(cost);
    expect(cost).toBeLessThanOrEqual(budget);
  }
}
