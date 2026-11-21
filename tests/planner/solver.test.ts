import { describe, expect, it } from "vitest";
import { plan } from "@/lib/planner";
import { heroIncident, heroSnapshot, heroTime } from "@/lib/scenarios/hero";
import { heroTie } from "@/tests/fixtures/hero-tie";

describe("branch-and-bound node budget", () => {
  it("keeps the better greedy seed even when no search nodes are available", () => {
    const { first_come, joint, solver } = plan(heroSnapshot, heroIncident, 100, 0);
    expect(first_come.on_time).toBe(1);
    expect(joint).toMatchObject({ on_time: 2, extra_cost_thb: 88 });
    expect(solver).toEqual({ mode: "branch_and_bound", optimality: "best_found", nodes: 0, node_limit: 0 });
  });

  it("proves the cheaper equal-count assignment exactly when the search can finish", () => {
    const snapshot = heroTie();
    const solve = (limit?: number) => plan(snapshot, heroIncident, 100, limit);
    const seeded = solve(0);
    expect(seeded.joint).toMatchObject({ on_time: 1, extra_cost_thb: 32 });
    const full = solve();
    expect(full.solver).toMatchObject({ optimality: "proven", node_limit: 200_000 });
    expect(full.joint).toMatchObject({ on_time: 1, extra_cost_thb: 16 });
    const justEnough = solve(full.solver.nodes);
    expect(justEnough.joint).toEqual(full.joint);
    expect(justEnough.solver.optimality).toBe("proven");
    const oneShort = solve(full.solver.nodes - 1);
    expect(oneShort.solver).toMatchObject({ nodes: full.solver.nodes - 1, optimality: "best_found" });
    expect(oneShort.joint.on_time).toBeGreaterThanOrEqual(oneShort.first_come.on_time);
  });

  it("proves the 12-order optimum when all orders compete for the same cheap stock", () => {
    const snapshot = structuredClone(heroSnapshot);
    snapshot.orders = Array.from({ length: 12 }, (_, i) => ({
      ...heroSnapshot.orders[0], id: String(101 + i), deadline_at: heroTime("19:00"),
    }));
    snapshot.order_lines = snapshot.orders.map(({ id }, i) => ({
      order_id: id, sku_id: "SKU-X", qty: i === 0 ? 2 : 1,
    }));
    const sources = { A: { units: 3, cost: 0 }, B: { units: 5, cost: 3 }, C: { units: 7, cost: 7 } };
    for (const row of snapshot.stock) {
      const { units, cost } = sources[row.warehouse_id];
      row.on_hand = units;
      row.committed = 0;
      row.extra_cost_per_unit_thb = cost;
    }
    const { joint, solver } = plan(snapshot, heroIncident, 32);
    // Ten single-unit orders cost 3×0 + 5×3 + 2×7. An eleventh unit would cost 36 total.
    expect(joint).toMatchObject({ on_time: 10, total: 12, extra_cost_thb: 29 });
    expect(joint.lines.map(line => line.order_id)).toEqual(snapshot.orders.slice(1, 11).map(order => order.id));
    expect(solver.optimality).toBe("proven");
  });
});
