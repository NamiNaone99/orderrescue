import type { PlanRequest } from "@/lib/domain/contracts";
import type { Snapshot } from "@/lib/domain/types";

type Placement = { order: string; warehouse: string; deadline: number; arrival: number };
type Rank = (number | string)[];

function rank(placements: Placement[], cost: number): Rank {
  const ascending = (a: number, b: number) => a - b;
  // Equal counts give identical positions and types for every subsequent level.
  return [
    -placements.length,
    ...placements.map(p => p.deadline).sort(ascending),
    cost,
    ...placements.map(p => p.arrival).sort(ascending),
    ...placements.flatMap(p => [p.order, p.warehouse]),
  ];
}

function isEarlier(left: Rank, right: Rank): boolean {
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) return left[index] < right[index];
  }
  return false;
}

/** Exhaustive test reference. The digits of an assignment select a warehouse or leave an order unserved. */
export function bruteForce(snapshot: Snapshot, incident: PlanRequest["incident"], budget: number) {
  const orders = snapshot.orders.flatMap(order => {
    const line = snapshot.order_lines.find(l => l.order_id === order.id && l.sku_id === incident.sku_id);
    if (!line || order.status !== "open" || order.home_warehouse_id !== incident.warehouse_id) return [];
    return [{ id: order.id, qty: line.qty, deadline: Date.parse(order.deadline_at), arrival: Date.parse(order.received_at) }];
  });
  if (orders.length > 8) throw new RangeError("The exhaustive reference is limited to eight affected orders");
  // This fixes the order of assignment pairs used by the last objective level.
  orders.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const rows = snapshot.warehouses.map(warehouse => {
    const row = snapshot.stock.find(row => row.warehouse_id === warehouse.id && row.sku_id === incident.sku_id);
    if (!row) return undefined;
    const home = row.warehouse_id === incident.warehouse_id;
    const ready = Math.max(Date.parse(row.ready_at), Date.parse(snapshot.scenario.now_at));
    const blocked = home && Date.parse(incident.window_start) <= ready && ready < Date.parse(incident.window_end);
    return { warehouse: row.warehouse_id, units: row.on_hand - row.committed,
      ready: blocked ? Date.parse(incident.window_end) : ready, price: home ? 0 : row.extra_cost_per_unit_thb };
  });

  const radix = rows.length + 1;
  const possibilities = radix ** orders.length;
  let best: Placement[] = [];
  let bestCost = 0;
  let bestRank = rank(best, bestCost);
  for (let assignment = 0; assignment < possibilities; assignment++) {
    const used = rows.map(() => 0);
    const placements: Placement[] = [];
    let digits = assignment;
    let cost = 0;
    let feasible = true;
    for (const order of orders) {
      const digit = digits % radix;
      digits = Math.floor(digits / radix);
      if (digit === 0) continue;
      const rowIndex = digit - 1;
      const row = rows[rowIndex];
      if (!row) {
        feasible = false;
        break;
      }
      used[rowIndex] += order.qty;
      cost += order.qty * row.price;
      if (used[rowIndex] > row.units || row.ready > order.deadline || cost > budget) {
        feasible = false;
        break;
      }
      placements.push({ order: order.id, warehouse: row.warehouse, arrival: order.arrival, deadline: order.deadline });
    }
    if (feasible) {
      const currentRank = rank(placements, cost);
      if (isEarlier(currentRank, bestRank)) {
        best = placements;
        bestCost = cost;
        bestRank = currentRank;
      }
    }
  }
  return { onTime: best.length, cost: bestCost, assignments: best.map(p => [p.order, p.warehouse]) };
}
