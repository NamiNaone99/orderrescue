import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { demoCases } from "../lib/client/demo-cases";
import { caseCopy } from "../lib/copy";
import { heroFollowups } from "../lib/domain/chat-samples";
import { planResponseSchema } from "../lib/domain/contracts";
import { resetDemo } from "./helpers";

test("five presenter cases open grounded examples and run their own desk actions", async ({ page, request }) => {
  test.setTimeout(110_000);
  await resetDemo(request);
  const changes: string[] = [];
  const interpretation: string[] = [];
  page.on("request", req => {
    const path = new URL(req.url()).pathname;
    if (req.method() === "POST" && ["/api/reservations", "/api/demo/reset", "/api/demo/event", "/api/chat/apply"].includes(path)) changes.push(path);
    if (path === "/api/interpret") interpretation.push(req.postDataJSON().message);
  });
  for (const [index, item] of demoCases.entries()) {
    await page.setViewportSize(index % 2 ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    await page.goto("/");
    const selected = page.locator("#demo-case");
    await expect(selected.locator("option")).toHaveCount(6);
    const count = interpretation.length;
    await selected.selectOption(item.id);
    const panel = page.locator(".demo-cases");
    await expect(panel).toHaveAttribute("data-case", item.id);
    await expect(page.locator("#scenario-choice")).toHaveValue(item.scenario);
    await expect(panel.getByRole("heading", { name: new RegExp(caseCopy.cases[item.id].title.en) })).toBeVisible();
    const message = await panel.locator("q").innerText();
    await expect(page.locator("#warehouse-message")).toHaveValue(message);
    expect(interpretation).toHaveLength(count);
    const action = page.locator("#case-action");
    for (const control of [selected, action]) {
      const bounds = await control.boundingBox();
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
      expect(bounds?.width).toBeGreaterThanOrEqual(44);
    }
    const response = page.waitForResponse(res => new URL(res.url()).pathname === "/api/plan" && res.request().method() === "POST");
    await action.click();
    if (item.id === "shock") {
      await expect(action).toHaveText(caseCopy.chooseSku.th);
      await action.click();
      const radios = page.getByRole("radio");
      await expect(radios.first()).toBeFocused();
      await radios.first().check();
    }
    const plan = planResponseSchema.parse(await (await response).json());
    await expect(panel.locator(".case-result")).toContainText(plan.joint.on_time + "/" + plan.affected.length);
    await expect(panel.locator(".case-result")).toContainText("฿" + plan.joint.extra_cost_thb);
    expect(interpretation.slice(count)).toEqual([message]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (item.id === "flood") {
      expect([plan.first_come.on_time, plan.joint.on_time, plan.joint.extra_cost_thb]).toEqual([1,2,88]);
      await action.click();
      await expect(page.locator("#desk-why")).toHaveJSProperty("open", true);
    } else if (item.id === "campaign") {
      await action.click();
      await expect(page.locator("#desk-frontier")).toHaveJSProperty("open", true);
      await expect(page.locator(".frontier-values li").first()).toBeVisible();
    } else if (item.id === "shock") {
      const other = page.waitForRequest(req => new URL(req.url()).pathname === "/api/plan" && req.method() === "POST");
      await action.click();
      expect((await other).postDataJSON().incident.sku_id).toBe("23355");
    } else {
      await action.click();
      const update = heroFollowups[item.id === "carrier" ? 0 : 1];
      await expect(page.locator("#chat-message")).toHaveValue(update.text);
      await expect(page.locator("#chat-message")).toBeFocused();
    }
    expect(changes).toEqual([]);
    if (item.id === "campaign" || item.id === "flood") {
      const audit = await new AxeBuilder({page}).include(".demo-cases").withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze();
      expect(audit.violations).toEqual([]);
    }
  }
  // Starting the established tour explicitly resets hero. Leaving it for the picker is read-only.
  await page.setViewportSize({ width: 390, height: 844 });
  const tourStart = page.waitForResponse(res => new URL(res.url()).pathname === "/api/demo/reset");
  await page.goto("/?tour=1");
  await tourStart;
  const chooseCases = page.getByRole("button", { name: caseCopy.all.th });
  const tourTarget = await chooseCases.boundingBox();
  expect(tourTarget?.width).toBeGreaterThanOrEqual(44);
  expect(tourTarget?.height).toBeGreaterThanOrEqual(44);
  const coach = await page.locator(".tour-coach").boundingBox();
  if (!coach) throw new Error("Expected the first tour step");
  expect(coach.y).toBeGreaterThanOrEqual(0);
  expect(coach.y + coach.height).toBeLessThanOrEqual(844);
  await chooseCases.click();
  await expect(page.locator("#demo-case")).toBeFocused();
  expect(changes).toEqual(["/api/demo/reset"]);
});
