import { describe, expect, it } from "vitest";
import { publicState } from "@/lib/api/state";
import { planChanges } from "@/lib/client/plan-changes";
import { plan as makePlan } from "@/lib/planner";
import { heroSnapshot, heroIncident } from "@/lib/scenarios/hero";

function hero() {
  const state = publicState({ ...heroSnapshot, state_version: "seed" });
  const plan = makePlan(heroSnapshot, heroIncident, 100);
  return { state, plan };
}

describe("plan-specific stock and order changes", () => {
  it("ignores unrelated revisions and detects a used row's new ready time only once", () => {
    const { state, plan } = hero();
    const next = structuredClone(state);
    next.stock[0].revision++;
    next.state_version = "unrelated mutation";
    expect(planChanges(plan, state, next)).toEqual([]);
    const b = next.stock.find(row => row.warehouse_id === "B");
    if (!b) throw new Error("Missing hero B");
    b.revision++;
    b.ready_at = "2026-11-21T14:30:00+07:00";
    expect(planChanges(plan, state, next)).toEqual([{ kind: "stock", warehouse: "B", sku: "SKU-X",
      before: 1, after: 2, oldReady: "2026-11-21T13:30:00+07:00", newReady: b.ready_at }]);
  });

  it("includes baseline-only stock and every affected order, including unassigned or missing orders", () => {
    const { state, plan } = hero();
    const next = structuredClone(state);
    plan.joint.lines = [];
    next.stock = next.stock.filter(row => row.warehouse_id !== "B");
    const reserved = next.orders[0];
    reserved.status = "reserved";
    const missing = next.orders.pop();
    const changes = planChanges(plan, state, next);
    expect(changes).toContainEqual(expect.objectContaining({ kind: "stock", warehouse: "B", after: null }));
    expect(changes).toContainEqual({ kind: "order", id: reserved.id, status: "reserved" });
    expect(changes).toContainEqual({ kind: "order", id: missing?.id, status: null });
  });
});
