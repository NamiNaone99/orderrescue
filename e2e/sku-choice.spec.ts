import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { copy } from "../lib/copy";
import { planRequestSchema } from "../lib/domain/contracts";
import { realDaySamples } from "../lib/scenarios/realDayFormat";
import { resetDemo } from "./helpers";

test.skip(!existsSync("data/derived/day-2011-11-22.json"), "The real-day scenario is not registered in a hero-only build.");

test("keeps the operator's second SKU choice when the same message is analysed again", async ({ page, request }) => {
  test.setTimeout(65_000);
  await resetDemo(request, "real-day");
  await page.goto("/?scenario=real-day");
  const sample = realDaySamples[1];
  await page.getByRole("button", { name: sample.label_th, exact: true }).click();
  await expect(page.getByLabel(copy.message.th, { exact: true })).toHaveValue(sample.text);
  const analyse = page.getByRole("button", { name: copy.analyse.th });
  await analyse.click();
  const [firstSku, secondSku] = sample.expected.skus;
  const choices = page.getByRole("group", { name: copy.chooseSku.th });
  const first = choices.getByRole("radio", { name: new RegExp(firstSku) });
  const chosen = choices.getByRole("radio", { name: new RegExp(secondSku) });
  await expect(first).toBeVisible({ timeout: 25_000 });
  await expect(first).not.toBeChecked();
  await expect(chosen).not.toBeChecked();

  // Observe each POST separately so the previous selection or plan cannot satisfy re-analysis.
  async function planAfter(action: () => Promise<void>) {
    const [response] = await Promise.all([
      page.waitForResponse(res => new URL(res.url()).pathname === "/api/plan" && res.request().method() === "POST"),
      action(),
    ]);
    expect(response.status()).toBe(200);
    expect(planRequestSchema.parse(response.request().postDataJSON()).incident.sku_id).toBe(secondSku);
    await expect(chosen).toBeChecked();
  }
  await planAfter(() => chosen.check());
  await planAfter(() => analyse.click());
});
