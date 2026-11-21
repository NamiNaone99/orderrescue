import { expect, it } from "vitest";
import { plan } from "@/lib/planner";
import { heroIncident } from "@/lib/scenarios/hero";
import { heroSplit, heroSplitExpected } from "@/tests/fixtures/hero-split";

it("allocates neither eight-unit line across two warehouses holding four free units each", () => {
  const result = plan(heroSplit(), heroIncident, 100);
  for (const kind of ["first_come", "joint"] as const) {
    const strategy = result[kind];
    expect(strategy).toEqual({
      ...heroSplitExpected[kind],
      needs_human: expect.arrayContaining([...heroSplitExpected[kind].needs_human]),
    });
    expect(strategy.needs_human).toHaveLength(2);
  }
});
