import { describe, expect, it } from "vitest";
import { firstStep, tourPosition, type TourFacts } from "@/lib/client/tour";

const empty: TourFacts = { analysed: false, hasPlan: false, slipped: false, stale: false, replanned: false, booked: false };
const planned = { ...empty, analysed: true, hasPlan: true };

describe("guided demo steps", () => {
  it("requires actual analysis, the delay and a fresh replan before each action gate", () => {
    expect(tourPosition(firstStep, "next", empty)).toBe(firstStep);
    let state = tourPosition(firstStep, "observe", planned);
    expect(state.step).toBe(2);
    expect(tourPosition(state, "observe", planned)).toBe(state);
    for (const n of [3, 4, 5, 6]) {
      state = tourPosition(state, "next", planned);
      expect(state.step).toBe(n);
    }
    expect(tourPosition(state, "next", planned)).toBe(state);
    const slipped = { ...planned, slipped: true, stale: true };
    state = tourPosition(state, "observe", slipped);
    expect(state.step).toBe(7);
    expect(tourPosition(state, "next", slipped)).toBe(state);
    state = tourPosition(state, "observe", { ...slipped, stale: false, replanned: true });
    expect(state.step).toBe(8);
    expect(tourPosition(state, "next", { ...planned, booked: true })).toBe(state);
  });
  it("reveals a real receipt even if the dispatcher confirms earlier than the suggested step", () => {
    expect(tourPosition({ step: 5, furthest: 5 }, "observe", { ...planned, booked: true })).toEqual({ step: 8, furthest: 8 });
  });
  it("allows replaying explanations without automatically repeating past actions", () => {
    const back = tourPosition({ step: 7, furthest: 7 }, "back", planned);
    expect(back).toEqual({ step: 6, furthest: 7 });
    expect(tourPosition(back, "observe", { ...planned, stale: true, slipped: true })).toBe(back);
    expect(tourPosition(back, "next", planned)).toEqual({ step: 7, furthest: 7 });
  });
});
