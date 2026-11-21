import { expect, it } from "vitest";
import { plan } from "@/lib/planner";
import { heroIncident, heroTime } from "@/lib/scenarios/hero";
import { heroAfterSlip } from "./hero-stock";

it("uses B's new revision and sends only #102 after B slips to 14:30", () => {
  const { joint } = plan(heroAfterSlip(), heroIncident, 100);
  expect(joint).toEqual({
    on_time: 1, total: 2, extra_cost_thb: 32,
    lines: [{
      order_id: "102", sku_id: "SKU-X", warehouse_id: "B", qty: 8, unit_cost_thb: 4,
      ready_at: heroTime("14:30"), deadline_at: heroTime("16:00"), expected_revision: 2,
    }],
    needs_human: [{ order_id: "101", reason: "NO_ON_TIME_SOURCE" }],
  });
});
