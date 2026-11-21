import { expect, test } from "@playwright/test";
import { tourCopy as c } from "../lib/copy";
import { planResponseSchema, reservationResponseSchema, stateResponseSchema } from "../lib/domain/contracts";

test("the guided demo runs real actions, books once and restores its receipt on reload", async ({ page }) => {
  const resetPath = "/api/demo/reset";
  const resetRequests: unknown[] = [];
  const bookings: unknown[] = [];
  page.on("request", request => {
    const path = new URL(request.url()).pathname;
    if (path === resetPath) resetRequests.push(request.postDataJSON());
    if (path === "/api/reservations") bookings.push(request.postDataJSON());
  });
  const resetResponse = () => page.waitForResponse(response => new URL(response.url()).pathname === resetPath);
  const first = resetResponse();
  await page.goto("/?tour=1&notes=1");
  const coach = page.locator(".tour-coach");
  if ((await first).status() === 429) {
    // The existing hero reset window is shared across this serial browser suite.
    test.setTimeout(test.info().timeout + 70_000);
    await expect.poll(async () => {
      const result = resetResponse();
      await coach.getByRole("button", { name: c.retry.th }).click();
      return (await result).status();
    }, { timeout: 70_000, intervals: [1_000, 5_000, 10_000] }).toBe(200);
  }
  const act = () => coach.getByRole("button", { name: new RegExp(c.doIt.th) }).click();
  const step = (value: number) => expect(coach).toHaveAttribute("data-tour-step", String(value));
  await step(1);
  await expect(page.getByRole("complementary", { name: c.notes.th })).toBeVisible();
  const planned = page.waitForResponse(response => new URL(response.url()).pathname === "/api/plan");
  await act();
  await step(2);
  const initial = planResponseSchema.parse(await (await planned).json());
  await expect(page.locator("#desk-incident mark")).toContainText("SKU-X");
  await act();
  await step(3);
  await expect(coach).toContainText("#101");
  await act();
  await step(4);
  await expect(coach).toContainText(initial.first_come.on_time + "/" + initial.first_come.total);
  await expect(coach).toContainText("฿" + initial.first_come.extra_cost_thb);
  await act();
  await step(5);
  await expect(coach).toContainText(initial.joint.on_time + "/" + initial.joint.total);
  await expect(coach).toContainText("฿" + initial.joint.extra_cost_thb);
  for (const budget of [31, initial.budget_thb]) {
    const updated = page.waitForResponse(response => new URL(response.url()).pathname === "/api/plan");
    await page.locator("#desk-budget").fill(String(budget));
    const plan = planResponseSchema.parse(await (await updated).json());
    await expect(coach).toContainText(plan.joint.on_time + "/" + plan.joint.total);
    await expect(coach).toContainText("฿" + plan.joint.extra_cost_thb);
    await expect(coach).toContainText("฿" + plan.budget_thb);
  }
  await act();
  await step(6);
  await act();
  await step(7);
  await expect(page.locator(".confirm-slot button")).toBeDisabled();
  // An unrelated revision changes between the real replan and the desk's next stock read.
  const state = stateResponseSchema.parse(await (await page.request.get("/api/state?scenario=hero&sku=SKU-X")).json());
  const unused = state.stock.find(row => row.warehouse_id === "A" && row.sku_id === "SKU-X");
  if (!unused) throw new Error("Expected the unused source warehouse in the hero fixture");
  unused.revision++;
  await page.route("**/api/state?**", route => route.fulfill({ json: { ...state, state_version: "unrelated-A-change" } }));
  await act();
  await step(8);
  await page.unrouteAll({ behavior: "wait" });
  await expect(coach).toContainText("#102/B");
  await expect(coach).toContainText("#101");
  await act();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").locator(".tour-coach")).toBeVisible();
  const posted = page.waitForResponse(response => new URL(response.url()).pathname === "/api/reservations");
  await act();
  const response = await posted;
  expect(response.status()).toBe(201);
  const { receipt } = reservationResponseSchema.parse(await response.json());
  await expect(coach).toHaveAttribute("data-tour-phase", "receipt");
  await expect(page.locator("#desk-receipt")).toContainText(receipt.id.slice(0, 8));
  await expect(page).toHaveURL(new RegExp("receipt=" + receipt.id));
  const resetCount = resetRequests.length;
  expect(resetRequests.every(request => JSON.stringify(request) === JSON.stringify({ scenario: "hero" }))).toBe(true);
  await page.reload();
  await expect(coach).toHaveAttribute("data-tour-phase", "receipt");
  const savedPanel = page.locator("#desk-receipt");
  await expect(savedPanel).toContainText(receipt.id.slice(0, 8));
  await expect(page.locator(".workflow li:last-child")).toHaveAttribute("aria-current", "step");
  await expect(page.locator(".stock-row[data-reserved=true]")).toContainText(receipt.lines[0].warehouse_id);
  expect(await savedPanel.evaluate(el => el.clientWidth > 480 && el.scrollWidth <= el.clientWidth)).toBe(true);
  const download = page.waitForEvent("download");
  await savedPanel.getByRole("button", { name: /CSV/ }).click();
  expect((await download).suggestedFilename()).toBe("orderrescue-" + receipt.id + ".csv");
  await coach.getByRole("button", { name: new RegExp(c.finish.th) }).click();
  await coach.getByRole("button", { name: c.keep.th }).click();
  await expect(coach).toHaveCount(0);
  await expect(page.locator("#start-guided-demo")).toBeFocused();
  expect(resetRequests).toHaveLength(resetCount);
  expect(bookings).toHaveLength(1);
});
