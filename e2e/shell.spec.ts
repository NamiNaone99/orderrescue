import { expect, test } from "@playwright/test";
import { copy, dataCopy } from "../lib/copy";
import { resetDemo } from "./helpers";

test.beforeEach(async ({ request }) => { await resetDemo(request); });

test("navigates the desk and resets the hero without a token", async ({ page }) => {
  await page.route("**/api/health", route => route.fulfill({ json: {
    ok: true, storage: "memory", interpreter: "offline", model: null, degraded: false, commit: "dev",
  } }));
  await page.route("**/api/demo/reset", route => route.fulfill({ json: { ok: true } }));
  await page.goto("/");
  await expect(page).toHaveTitle("OrderRescue · " + copy.desk.th);
  await expect(page.getByText("AI: offline")).toBeVisible();
  await expect(page.getByText("DB: memory")).toBeVisible();
  await expect(page.getByLabel(copy.scenario.th, { exact: true })).toHaveValue("hero");
  const apiRequest = page.waitForRequest(request => request.url().endsWith("/api/demo/reset"));
  await page.getByRole("button", { name: copy.reset.th }).click();
  const request = await apiRequest;
  expect(request.method()).toBe("POST");
  expect(request.postDataJSON()).toEqual({ scenario: "hero" });
  expect(request.headers()["x-demo-token"]).toBeUndefined();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("navigation").getByRole("link", { name: copy.data.th }).click();
  await expect(page).toHaveURL(/\/data\?scenario=hero$/);
  await expect(page.getByRole("heading", { level: 1, name: new RegExp(dataCopy.title.th) })).toBeVisible();
  await page.getByRole("navigation").getByRole("link", { name: copy.built.th }).click();
  await expect(page.getByRole("heading", { name: copy.built.th })).toBeVisible();
});

test("keeps the mobile desk usable when health is unavailable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/health", route => route.fulfill({ status: 404, body: "" }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: copy.desk.th })).toBeVisible();
  await expect(page.getByText("AI: —")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.getByLabel(copy.scenario.th, { exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("tooltip")).toContainText(copy.scenarioHint.th);
});
