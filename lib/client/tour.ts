export type TourPosition = { step: number; furthest: number };
export type TourFacts = { analysed: boolean; hasPlan: boolean; slipped: boolean; stale: boolean; replanned: boolean; booked: boolean };
export const firstStep: TourPosition = { step: 1, furthest: 1 };

export function tourPosition(current: TourPosition, action: "next" | "back" | "observe", facts: TourFacts): TourPosition {
  const { step, furthest } = current;
  if (action === "observe" && facts.booked && furthest < 8) return { step: 8, furthest: 8 };
  if (action === "back") return step > 1 ? { ...current, step: step - 1 } : current;
  if (step < furthest) return action === "next" ? { ...current, step: step + 1 } : current;
  if (step >= 8) return current;
  const ready = step === 1 ? facts.analysed && facts.hasPlan
    : step === 6 ? facts.slipped && facts.stale
    : step === 7 ? facts.replanned : facts.hasPlan;
  if (!ready || (action === "observe" && step !== 1 && step !== 6 && step !== 7)) return current;
  return { step: step + 1, furthest: step + 1 };
}
