import { heroSnapshot } from "@/lib/scenarios/hero";

export function heroSplit() {
  const snapshot = structuredClone(heroSnapshot);
  for (const row of snapshot.stock) {
    if (row.warehouse_id === "B") row.on_hand = 16;
    if (row.warehouse_id === "C") row.on_hand = 4;
  }
  return snapshot;
}

const noAllocation = {
  on_time: 0, total: 2, extra_cost_thb: 0, lines: [],
  needs_human: [
    { order_id: "101", reason: "NO_ON_TIME_SOURCE" },
    { order_id: "102", reason: "NO_ON_TIME_SOURCE" },
  ],
} as const;

export const heroSplitExpected = { first_come: noAllocation, joint: noAllocation };
