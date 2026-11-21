import { heroSnapshot, heroTime } from "@/lib/scenarios/hero";

export function heroLateOrder(deadline: "19:00" | "17:59" = "19:00") {
  const snapshot = structuredClone(heroSnapshot);
  snapshot.orders.push({
    id: "103",
    received_at: heroTime("10:00"),
    deadline_at: heroTime(deadline),
    home_warehouse_id: "A",
    customer_ref: null,
    status: "open",
  });
  snapshot.order_lines.push({ order_id: "103", sku_id: "SKU-X", qty: 4 });
  return snapshot;
}

const earlierOrders = [
  { order_id: "101", warehouse_id: "B" },
  { order_id: "102", warehouse_id: "C" },
];

export const heroLateOrderExpected = {
  "19:00": {
    joint: {
      on_time: 3, total: 3, extra_cost_thb: 88,
      lines: [
        ...earlierOrders,
        { order_id: "103", warehouse_id: "A", unit_cost_thb: 0, ready_at: heroTime("18:00") },
      ],
      needs_human: [],
    },
  },
  "17:59": {
    joint: {
      on_time: 2, total: 3, extra_cost_thb: 88, lines: earlierOrders,
      needs_human: [{ order_id: "103", reason: "NOT_SELECTED" }],
    },
  },
} as const;
