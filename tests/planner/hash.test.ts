import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { PlanRequest, ReservationRequest } from "@/lib/domain/contracts";
import { plan } from "@/lib/planner";
import { planHash } from "@/lib/planner/hash";
import { heroIncident, heroSnapshot, heroTime } from "@/lib/scenarios/hero";

type BookingLine = ReservationRequest["lines"][number];

const line101: BookingLine = {
  order_id: "101", sku_id: "SKU-X", warehouse_id: "B", qty: 8, unit_cost_thb: 4, expected_revision: 1,
};
const line102: BookingLine = {
  order_id: "102", sku_id: "SKU-X", warehouse_id: "C", qty: 8, unit_cost_thb: 7, expected_revision: 1,
};

// SHA-256 computed independently over the UTF-8 SPEC §5 payload for #101 via B and #102 via C.
const heroDigest = "b01136be688e152fa1989058fa6070cb8de7dac5162e820eee17ec2dcaad41e7";

describe("planHash", () => {
  it("produces the pinned digest for both booking lines and full planner lines", () => {
    const reversed = [line102, line101];
    expect(planHash("hero", heroIncident, 100, reversed)).toBe(heroDigest);
    expect(reversed).toEqual([line102, line101]);

    const result = plan(heroSnapshot, heroIncident, 100);
    expect(planHash("hero", heroIncident, 100, result.joint.lines)).toBe(heroDigest);
  });

  it("ignores display times, interpretation text and incoming object key order", () => {
    const reorderedIncident = {
      source_message: "ข้อความทดสอบ", evidence_quote: "ทดสอบ",
      window_end: heroIncident.window_end, window_start: heroIncident.window_start,
      sku_id: heroIncident.sku_id, warehouse_id: heroIncident.warehouse_id,
    };
    const displayedLines = [line102, line101].map((line) => ({
      ready_at: heroTime("14:30"), deadline_at: heroTime("19:00"),
      expected_revision: line.expected_revision, unit_cost_thb: line.unit_cost_thb,
      qty: line.qty, warehouse_id: line.warehouse_id, sku_id: line.sku_id, order_id: line.order_id,
    }));
    expect(planHash("hero", reorderedIncident, 100, displayedLines)).toBe(heroDigest);
  });

  it("binds the scenario, budget, incident fields and every field on the confirmed lines", () => {
    const lines = [line101, line102];
    expect(planHash("real-day", heroIncident, 100, lines)).not.toBe(heroDigest);
    expect(planHash("hero", heroIncident, 88, lines)).not.toBe(heroDigest);
    expect(planHash("hero", heroIncident, 100, [line101])).not.toBe(heroDigest);
    const incidentChanges: Partial<PlanRequest["incident"]>[] = [
      { warehouse_id: "B" }, { sku_id: "23084" },
      { window_start: heroTime("13:30") }, { window_end: heroTime("19:00") },
    ];
    for (const change of incidentChanges) {
      expect(planHash("hero", { ...heroIncident, ...change }, 100, lines)).not.toBe(heroDigest);
    }
    const lineChanges: Partial<BookingLine>[] = [
      { order_id: "201" }, { sku_id: "23084" }, { warehouse_id: "C" },
      { qty: 4 }, { unit_cost_thb: 7 }, { expected_revision: 2 },
    ];
    for (const change of lineChanges) {
      expect(planHash("hero", heroIncident, 100, [{ ...line101, ...change }, line102])).not.toBe(heroDigest);
    }
  });
});

it("returns a byte-identical plan and hash after independent snapshot permutations (AC-09)", () => {
  const baseline = JSON.stringify(plan(heroSnapshot, heroIncident, 100));
  const permutation = <T,>(rows: T[]) => fc.shuffledSubarray(rows, { minLength: rows.length });
  fc.assert(fc.property(fc.record({
    orders: permutation(heroSnapshot.orders),
    order_lines: permutation(heroSnapshot.order_lines),
    stock: permutation(heroSnapshot.stock),
    warehouses: permutation(heroSnapshot.warehouses),
  }), (shuffled) => {
    const actual = plan({ ...heroSnapshot, ...shuffled }, heroIncident, 100);
    expect(JSON.stringify(actual)).toBe(baseline);
    expect(planHash("hero", heroIncident, 100, actual.joint.lines)).toBe(heroDigest);
  }), { seed: 20261121, numRuns: 100 });
});
