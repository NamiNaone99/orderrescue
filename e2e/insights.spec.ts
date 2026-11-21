import { expect, test } from "@playwright/test";
import { copy, insightCopy } from "../lib/copy";
import { analyseHero, resetDemo } from "./helpers";

test("explains hero alternatives and checks budgets without interpreting or reserving again", async ({ page, request }) => {
  await resetDemo(request);
  const planned: number[] = [];
  let interpretations = 0, bookings = 0;
  page.on("request", r => {
    const path = new URL(r.url()).pathname;
    if (path === "/api/plan") planned.push(r.postDataJSON().budget_thb);
    if (path === "/api/interpret") interpretations++;
    if (path === "/api/reservations") bookings++;
  });
  await analyseHero(page);
  const why = page.locator(".plan-insights summary").filter({ hasText: insightCopy.why.th });
  await why.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "#101" })).toContainText("ส่งไม่ทัน · พร้อม 15:00");
  expect(planned).toEqual([100]);
  const open = page.locator(".plan-insights summary").filter({ hasText: insightCopy.frontier.th });
  await open.click();
  await expect(page.locator(".frontier-values li")).toHaveText(["฿0 · 0/2", "฿32 · 1/2", "฿88 · 2/2"]);
  const chart = await page.locator(".insight-chart svg").boundingBox();
  expect(chart?.width ?? 0).toBeGreaterThan(240);
  expect(chart?.height ?? 0).toBeGreaterThan(90);
  expect(planned.length).toBeLessThanOrEqual(7);
  const count = planned.length;
  await open.click(); await open.click();
  await expect(page.getByRole("slider", { name: insightCopy.change.th })).toBeVisible();
  expect(planned).toHaveLength(count);
  const slider = page.getByRole("slider", { name: insightCopy.change.th });
  await slider.focus(); await page.keyboard.press("Home");
  await expect(page.locator(".current-budget")).toContainText("฿0 · 0/2");
  await expect(page.getByRole("article", { name: copy.joint.th })).toContainText("0/2");
  expect(interpretations).toBe(1);
  expect(bookings).toBe(0);
});

test("discards a budget comparison if the scenario changes between reads", async ({ page, request }) => {
  await resetDemo(request);
  await analyseHero(page);
  let comparisons = 0;
  await page.route("**/api/plan", async route => {
    comparisons++;
    const result = await route.fetch();
    await route.fulfill({ response: result, json: { ...await result.json(), state_version: "changed-between-reads" } });
  });
  await page.locator(".plan-insights summary").filter({ hasText: insightCopy.frontier.th }).click();
  await expect(page.getByText(insightCopy.changed.th)).toBeVisible();
  await expect(page.locator(".frontier-values")).toHaveCount(0);
  await expect(page.getByRole("button", { name: copy.replan.th })).toBeEnabled();
  expect(comparisons).toBe(1);
});
