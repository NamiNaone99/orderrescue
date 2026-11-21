import { caseCopy } from "@/lib/copy";

export const demoCases = [
  { id: "flood", scenario: "hero", sample: 0 },
  { id: "campaign", scenario: "real-day", sample: 0 },
  { id: "shock", scenario: "real-day", sample: 1 },
  { id: "carrier", scenario: "hero", sample: 0 },
  { id: "shortage", scenario: "hero", sample: 0 },
] as const satisfies readonly { id: keyof typeof caseCopy.cases; scenario: "hero" | "real-day"; sample: number }[];

export type DemoCase = typeof demoCases[number];
export function findDemoCase(id: string | null) {
  return demoCases.find(item => item.id === id);
}
export function caseHref(item: DemoCase) {
  return "/?scenario=" + item.scenario + "&case=" + item.id;
}
