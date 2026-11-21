import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { copy } from "../lib/copy";
import { planResponseSchema } from "../lib/domain/contracts";
import { resetDemo } from "./helpers";

test.skip(!existsSync("data/derived/day-2011-11-22.json"), "The real-day scenario is not registered in a hero-only build.");

test("switches to real-day and shows the affected orders with their data attribution", async ({ page, request }) => {
  await resetDemo(request, "real-day");
  await page.goto("/?scenario=hero");
  const scenario = page.getByRole("combobox", { name: copy.scenario.th });
  await expect(scenario).toHaveValue("hero");
  await scenario.selectOption("real-day");
  await page.getByRole("button", { name: "ชั้นวางพัง", exact: true }).click();
  await expect(page.getByLabel(copy.message.th, { exact: true })).toHaveValue(
    "คลัง A เตรียมสินค้า 23084 ไม่ได้ช่วง 13:00–18:00 วันนี้ เพราะชั้นวางพัง",
  );
  const badge = page.locator(".data-badge");
  await expect(badge).toHaveAttribute("href", "/data?scenario=real-day");
  await expect(badge).toContainText(copy.realDerived.th);
  await expect(badge).toContainText(copy.realDerived.en);

  const [response] = await Promise.all([
    page.waitForResponse(res => new URL(res.url()).pathname === "/api/plan" && res.request().method() === "POST"),
    page.getByRole("button", { name: copy.analyse.th }).click(),
  ]);
  expect(response.status()).toBe(200);
  const { affected } = planResponseSchema.parse(await response.json());
  expect(affected.length).toBeGreaterThan(10);
  const orders = page.getByRole("region", { name: copy.affected.th });
  await expect(orders.getByRole("rowgroup").last().getByRole("row")).toHaveCount(affected.length);
});
