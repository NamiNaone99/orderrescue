import { heroSnapshot, heroTime } from "@/lib/scenarios/hero";

export function heroTie(swapIds = false) {
  const snapshot = structuredClone(heroSnapshot);
  const largeOrder = swapIds ? "202" : "201";
  const smallOrder = swapIds ? "201" : "202";
  snapshot.stock = snapshot.stock.map(row =>
    row.warehouse_id === "C" ? { ...row, on_hand: 0 } : row,
  );
  snapshot.orders = [
    {
      id: largeOrder, received_at: heroTime("09:00"), deadline_at: heroTime("14:00"),
      home_warehouse_id: "A", customer_ref: null, status: "open",
    },
    {
      id: smallOrder, received_at: heroTime("09:05"), deadline_at: heroTime("14:00"),
      home_warehouse_id: "A", customer_ref: null, status: "open",
    },
  ];
  snapshot.order_lines = [
    { order_id: largeOrder, sku_id: "SKU-X", qty: 8 },
    { order_id: smallOrder, sku_id: "SKU-X", qty: 4 },
  ];
  return snapshot;
}

export const heroTieExpected = {
  first_come: {
    on_time: 1, total: 2, extra_cost_thb: 32,
    lines: [{ order_id: "201", warehouse_id: "B", qty: 8 }],
  },
  joint: {
    on_time: 1, total: 2, extra_cost_thb: 16,
    lines: [{ order_id: "202", warehouse_id: "B", qty: 4 }],
  },
} as const;

export const heroTieSwappedExpected = {
  joint: {
    ...heroTieExpected.joint,
    lines: [{ order_id: "201", warehouse_id: "B", qty: 4 }],
  },
} as const;
