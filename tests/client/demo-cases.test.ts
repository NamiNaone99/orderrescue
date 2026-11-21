import { expect, it } from "vitest";
import { caseHref, demoCases, findDemoCase } from "@/lib/client/demo-cases";
import { validate } from "@/lib/interpreter/validate";
import { offlineInterpret } from "@/lib/interpreter/offline";
import { scenarioRegistry } from "@/lib/scenarios";

it.each(demoCases)("opens $id with a known, independently validated scenario message", item => {
  const url = new URL(caseHref(item), "https://example.test");
  expect(findDemoCase(url.searchParams.get("case"))).toBe(item);
  expect(url.searchParams.get("scenario")).toBe(item.scenario);
  expect(url.searchParams.has("tour")).toBe(false);
  const { snapshot } = scenarioRegistry[item.scenario];
  const sample = snapshot.scenario.sample_messages[item.sample].text;
  const answer = validate(offlineInterpret(sample, snapshot), sample, snapshot);
  expect(answer.outcome).toBe("incident");
  expect(answer.incident?.sku_ids).toHaveLength(item.id === "shock" ? 2 : 1);
});

it("treats unknown case ids as the ordinary desk", () => {
  expect(findDemoCase("unknown")).toBeUndefined();
  expect(findDemoCase(null)).toBeUndefined();
});
