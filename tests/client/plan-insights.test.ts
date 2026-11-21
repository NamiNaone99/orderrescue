import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { publicState } from "@/lib/api/state";
import { attainedSteps, frontierBudgets, insightSources, observedBudget, optionText, orderExplanations } from "@/lib/client/plan-insights";
import { plan } from "@/lib/planner";
import { sourceRows } from "@/lib/planner/candidates";
import { heroIncident, heroSnapshot, heroTime } from "@/lib/scenarios/hero";
import { filterSnapshot } from "@/lib/store/types";
import { realDaySnapshot } from "@/lib/scenarios/realDayFormat";
import type { Snapshot } from "@/lib/domain/types";

function result(snapshot: Snapshot, budget: number, incident = heroIncident) {
  const state = publicState(filterSnapshot(snapshot, { sku: incident.sku_id }));
  const answer = { ...plan(snapshot, incident, budget), budget_thb: budget, plan_hash: "", state_version: state.state_version };
  return { state, answer };
}

function explanations(snapshot: Snapshot, budget: number) {
  const { state, answer } = result(snapshot, budget);
  return orderExplanations(answer, state, heroIncident);
}

describe("joint-plan insights", () => {
  it("finds the exact hero thresholds of ฿32 and ฿88 using actual planner answers", () => {
    const { state, answer } = result(heroSnapshot, 100);
    const { budgets, exact } = frontierBudgets(answer, sourceRows(state.stock, state.scenario.now_at, heroIncident));
    expect(exact).toBe(true);
    const steps = attainedSteps(budgets.map(budget => observedBudget(result(heroSnapshot, budget).answer)));
    expect(steps.map(({ budget, onTime }) => [budget, onTime])).toEqual([[0, 0], [32, 1], [88, 2]]);
  });

  it("explains chosen B/C, A's blocked window, C's missed deadline and B's allocation to another order", () => {
    const rows = explanations(heroSnapshot, 100);
    const early = rows.find(({ order }) => order.order_id === "101");
    const late = rows.find(({ order }) => order.order_id === "102");
    expect(early?.chosen).toBe("B");
    expect(late?.chosen).toBe("C");
    expect(early?.options.map(optionText)).toEqual(["ส่งไม่ทัน · พร้อม 18:00", "เลือกคลังนี้ · พร้อม 13:30", "ส่งไม่ทัน · พร้อม 15:00"]);
    expect(late?.options[1]).toMatchObject({ reason: "allocated", remaining: 0, cost: BigInt(32) });
    expect(late?.options[2]).toMatchObject({ reason: "chosen", cost: BigInt(56) });
  });

  it("explains the real delayed times and why #101 is unserved after B slips", () => {
    const snapshot = structuredClone(heroSnapshot);
    const row = snapshot.stock.find(source => source.warehouse_id === "B");
    if (!row) throw new Error("Missing hero warehouse B");
    row.ready_at = heroTime("14:30"); row.revision++;
    const explanation = explanations(snapshot, 100);
    const early = explanation.find(({ order }) => order.order_id === "101");
    expect(early?.chosen).toBeUndefined();
    expect(early?.options.map(optionText)).toEqual(["ส่งไม่ทัน · พร้อม 18:00", "ส่งไม่ทัน · พร้อม 14:30", "ส่งไม่ทัน · พร้อม 15:00"]);
    const late = explanation.find(({ order }) => order.order_id === "102");
    expect(late?.options.map(o => o.reason)).toEqual(["late", "chosen", "higherCost"]);
    expect(late?.options.map(optionText)).toContain("ส่งทัน · แพงกว่าคลังที่เลือก ฿24");
  });

  it("separates net free stock from a shared-budget shortfall", () => {
    const low = explanations(heroSnapshot, 87).find(({ order }) => order.order_id === "102");
    expect(low?.options[2]).toMatchObject({ reason: "budget", cost: BigInt(56), availableBudget: 55 });
    const snapshot = structuredClone(heroSnapshot);
    snapshot.stock = snapshot.stock.map(row => row.warehouse_id === "B" ? { ...row, committed: 13 } : row);
    expect(explanations(snapshot, 100)[0].options[1]).toMatchObject({ reason: "stock", free: 7 });
  });

  it("identifies a feasible equal-price source when the proven allocation uses its final ID tie-break", () => {
    const snapshot = structuredClone(heroSnapshot);
    snapshot.stock = snapshot.stock.map(row => row.warehouse_id === "B" ? { ...row, ready_at: heroTime("14:30") }
      : row.warehouse_id === "C" ? { ...row, extra_cost_per_unit_thb: 4 } : row);
    const late = explanations(snapshot, 100).find(({ order }) => order.order_id === "102");
    expect(late?.chosen).toBe("B");
    expect(late?.options[2].reason).toBe("tie");
  });

  it("accounts for a resumed home source when it is an unchosen alternative and when selecting frontier budgets", () => {
    const snapshot = structuredClone(heroSnapshot);
    snapshot.stock = snapshot.stock.map(row => row.warehouse_id === "A" ? { ...row, committed: 16 } : row);
    const effective = { ...heroIncident, window_end: heroTime("13:15") };
    const { state, answer } = result(snapshot, 100, effective);
    const resumed = { ...answer, effective_window_end: effective.window_end };
    const rows = orderExplanations(resumed, state, heroIncident);
    expect(rows.find(({ order }) => order.order_id === "102")?.options[0]).toMatchObject({
      warehouse: "A", reason: "allocated", remaining: 0, ready: heroTime("13:15"),
    });
    const { budgets } = frontierBudgets(resumed, insightSources(resumed, state, heroIncident));
    const steps = attainedSteps(budgets.map(budget => observedBudget(result(snapshot, budget, effective).answer)));
    expect(steps.map(p => [p.budget, p.onTime])).toEqual([[0, 1], [32, 2]]);
    expect(heroIncident.window_end).toBe(heroTime("18:00"));
  });

  const derivedDay = "data/derived/day-2011-11-22.json";
  it.skipIf(!existsSync(derivedDay))("limits the larger real-day comparison to six sampled planning budgets", () => {
    const snapshot = realDaySnapshot(JSON.parse(readFileSync(derivedDay, "utf8")));
    const incident = { ...heroIncident, sku_id: "23084" };
    const { state, answer } = result(snapshot, 200, incident);
    const { budgets, exact } = frontierBudgets(answer, sourceRows(state.stock, state.scenario.now_at, incident));
    expect(exact).toBe(false);
    expect(budgets).toHaveLength(6);
    expect(budgets[0]).toBe(0);
    expect(budgets).toEqual([...new Set(budgets)].sort((a, b) => a - b));
  });
});
