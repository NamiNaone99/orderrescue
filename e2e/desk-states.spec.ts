import { expect, test, type Page } from "@playwright/test";
import { copy } from "../lib/copy";
import { interpretResponseSchema, planResponseSchema } from "../lib/domain/contracts";
import { analyseHero, resetDemo } from "./helpers";

async function enterIncident(page: Page, warehouse: string, sku = "SKU-X", start = "13:00", end = "18:00") {
  await page.getByRole("button", { name: copy.manualEntry.th, exact: true }).click();
  const form = page.getByRole("form", { name: copy.manualEntry.th });
  await form.getByLabel(copy.warehouse.th, { exact: true }).selectOption(warehouse);
  await form.getByRole("combobox", { name: /SKU/ }).fill(sku);
  await form.getByLabel(copy.windowStart.th).fill(start);
  await form.getByLabel(copy.windowEnd.th).fill(end);
  await form.getByRole("button", { name: copy.manualPlan.th }).click();
}

test("ignore and quota fallback explain an unrelated message without planning", async ({ page }) => {
  let plans = 0;
  page.on("request", req => { if (new URL(req.url()).pathname === "/api/plan") plans++; });
  await page.route("**/api/interpret", async route => {
    const response = await route.fetch();
    const answer = interpretResponseSchema.parse(await response.json());
    await route.fulfill({ response, json: { ...answer, interpreter: { ...answer.interpreter, rate_limited: true } } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "ถามเรื่องกะงาน" }).click();
  await page.getByRole("button", { name: copy.analyse.th }).click();
  await expect(page.locator("#desk-incident")).toHaveText(copy.notPicking.th);
  await expect(page.locator("#desk-incident")).toBeFocused();
  await expect(page.locator(".fallback-note")).toContainText(copy.interpreterQuota.th);
  await expect(page.locator(".fallback-note")).toContainText("offline");
  await expect(page.locator("#desk-announcements")).toContainText(copy.notPicking.th);
  expect(plans).toBe(0);
});

test("manual entry stays usable after a firewall 429 and an empty plan offers a hero reset", async ({ page, request }) => {
  await resetDemo(request);
  await page.route("**/api/interpret", route => route.fulfill({ status: 429, body: "Too many requests" }));
  await page.goto("/");
  await page.getByRole("button", { name: copy.analyse.th }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(copy.limited.th);
  await enterIncident(page, "B");
  const comparison = page.getByRole("region", { name: copy.compare.th });
  await expect(comparison).toContainText(copy.noAffected.th);
  await expect(page.getByRole("button", { name: copy.confirmRows.th })).toBeDisabled();
  await comparison.getByRole("button", { name: copy.reset.th }).click();
  await expect(comparison).toContainText(copy.hint.th);
});

test("degraded storage prevents confirmation and a secondary model identifies itself", async ({ page, request }) => {
  await resetDemo(request);
  let degraded = false;
  await page.route("**/api/health", route => route.fulfill({ json: {
    ok: true, storage: degraded ? "memory" : "supabase", interpreter: "openai", model: "primary", degraded, commit: "test",
  } }));
  await page.route("**/api/interpret", async route => {
    const response = await route.fetch();
    const answer = interpretResponseSchema.parse(await response.json());
    await route.fulfill({ response, json: { ...answer, interpreter: { ...answer.interpreter, used: "openai:secondary",
      attempts: [{ name: "openai:primary", ok: false, reason: "timeout" }, { name: "openai:secondary", ok: true }] } } });
  });
  await analyseHero(page);
  await expect(page.locator(".fallback-note")).toContainText("openai:secondary");
  const review = page.getByRole("button", { name: copy.confirmRows.th });
  await review.click();
  degraded = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(copy.degraded.th)).toBeVisible();
  await expect(dialog.getByRole("button", { name: copy.confirm.th, exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: copy.cancel.th }).click();
  await expect(page.locator(".storage-banner")).toHaveText(copy.degraded.th);
  await expect(page.getByText("DB: memory")).toBeVisible();
  await expect(review).toBeDisabled();
  degraded = false;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(review).toBeEnabled();
});

test("real-day planning explains when the solver reaches its search limit", async ({ page }) => {
  await page.goto("/?scenario=real-day");
  await expect(page.getByLabel(copy.scenario.th, { exact: true })).toHaveValue("real-day");
  await expect(page.getByLabel(copy.message.th, { exact: true })).toHaveValue(/23084/);
  await page.getByRole("spinbutton", { name: copy.budget.th, exact: true }).fill("100");
  const planning = page.waitForResponse(response => new URL(response.url()).pathname === "/api/plan");
  await enterIncident(page, "A", "23084", "12:30", "13:00");
  const plan = planResponseSchema.parse(await (await planning).json());
  expect(plan.solver).toMatchObject({ optimality: "best_found", nodes: 200_000, node_limit: 200_000 });
  const limited = page.getByRole("button", { name: copy.bestFound.th });
  await limited.click();
  await expect(page.getByRole("tooltip")).toContainText(copy.bound.th);
  await expect(page.getByRole("tooltip")).toContainText("200,000");
});

test("plan, reservation and reset rate limits leave a route back to manual entry", async ({ page, request }) => {
  await resetDemo(request);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const limited = page.getByRole("main").getByRole("alert").filter({ hasText: copy.limited.th });
  const review = page.getByRole("button", { name: copy.confirmRows.th });
  await page.route("**/api/plan", route => route.fulfill({ status: 429 }), { times: 1 });
  await page.goto("/");
  await page.getByRole("button", { name: copy.analyse.th }).click();
  await expect(limited).toBeVisible();
  await enterIncident(page, "A");
  await review.click();
  const confirm = page.getByRole("dialog").getByRole("button", { name: copy.confirm.th, exact: true });
  await page.route("**/api/reservations", route => route.fulfill({ status: 429 }), { times: 1 });
  await confirm.click();
  await expect(limited).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await enterIncident(page, "A");
  await review.click();
  await confirm.focus();
  await confirm.press("Enter");
  const receipt = page.getByRole("region", { name: copy.receipt.th });
  await expect(receipt).toBeVisible();
  await page.locator('[data-slot="dialog-content"]').waitFor({ state: "detached" });
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(receipt).toBeFocused();
  await page.route("**/api/demo/reset", route => route.fulfill({ status: 429 }), { times: 1 });
  await receipt.getByRole("button", { name: copy.newIncident.th }).click();
  await expect(limited).toBeVisible();
  await expect(receipt).toBeVisible();
  await enterIncident(page, "A");
  await expect(page.getByRole("region", { name: copy.compare.th })).toContainText(copy.noAffected.th);
});

test("affected orders become labeled cards below 768 pixels", async ({ page, request }) => {
  await resetDemo(request);
  await page.setViewportSize({ width: 390, height: 844 });
  await analyseHero(page);
  const order = page.locator(".order-table tbody tr").filter({ hasText: "#101" });
  await expect(order).toHaveCSS("display", "grid");
  await expect(order.locator('td[data-label="' + copy.joint.th + '"]')).toHaveText("B");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.setViewportSize({ width: 767, height: 844 });
  await expect(order).toHaveCSS("display", "grid");
  await page.setViewportSize({ width: 768, height: 844 });
  await expect(order).toHaveCSS("display", "table-row");
});
