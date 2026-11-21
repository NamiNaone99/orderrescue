import { expect, it } from "vitest";
import { plan } from "@/lib/planner";
import { heroIncident, heroSnapshot } from "@/lib/scenarios/hero";
import { heroSplit } from "@/tests/fixtures/hero-split";
import { heroAfterSlip } from "./hero-stock";

it("keeps an individually affordable order NOT_SELECTED when its stock or budget goes to another order", () => {
  expect(plan(heroSnapshot, heroIncident, 100).first_come.needs_human).toEqual([
    { order_id: "101", reason: "NOT_SELECTED" },
  ]);
  expect(plan(heroSnapshot, heroIncident, 87).joint.needs_human).toEqual([
    { order_id: "102", reason: "NOT_SELECTED" },
  ]);
});

it("marks both orders OVER_BUDGET when even the cheapest on-time source is individually unaffordable", () => {
  const { first_come, joint } = plan(heroSnapshot, heroIncident, 31);
  for (const strategy of [first_come, joint]) {
    expect(strategy.needs_human).toHaveLength(2);
    expect(strategy.needs_human).toEqual(expect.arrayContaining([
      { order_id: "101", reason: "OVER_BUDGET" }, { order_id: "102", reason: "OVER_BUDGET" },
    ]));
  }
});

it("reports NO_ON_TIME_SOURCE before considering budget and distinguishes it from NO_STOCK", () => {
  expect(plan(heroAfterSlip(), heroIncident, 100).joint.needs_human).toEqual([
    { order_id: "101", reason: "NO_ON_TIME_SOURCE" },
  ]);
  const snapshot = heroSplit();
  const late = plan(snapshot, heroIncident, 0).joint;
  expect(late.needs_human.map(item => item.reason)).toEqual(["NO_ON_TIME_SOURCE", "NO_ON_TIME_SOURCE"]);

  for (const row of snapshot.stock) row.committed = row.on_hand;
  const none = plan(snapshot, heroIncident, 0);
  for (const strategy of [none.first_come, none.joint]) {
    expect(strategy.needs_human.map(item => item.reason)).toEqual(["NO_STOCK", "NO_STOCK"]);
  }
});
