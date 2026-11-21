import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { smokeOrigin, healthyCommit } from "./smoke-env";
import { copy } from "../lib/copy";
import type { ScenarioId } from "@/lib/domain/types";

export async function resetDemo(request: APIRequestContext, scenario: ScenarioId = "hero") {
  const remote = smokeOrigin().startsWith("https:");
  if (remote && scenario !== "hero") throw new Error("Hosted smoke resets only synthetic hero");
  async function reset() {
    if (remote) await healthyCommit(request);
    const response = await request.post("/api/demo/reset", {
      data: { scenario },
      headers: scenario === "hero" ? {} : { "x-demo-token": process.env.DEMO_RESET_TOKEN ?? "local-token" },
      maxRedirects: 0,
    }).catch(() => { throw new Error("Demo reset request failed"); });
    return response.status();
  }

  let status = await reset();
  if (status === 429) {
    // The hero reset window allows six admissions per minute across the serial suite.
    const windowTimeout = 70_000;
    test.setTimeout(test.info().timeout + windowTimeout);
    await expect.poll(async () => {
      status = await reset();
      return status;
    }, { timeout: windowTimeout, intervals: [1_000, 5_000, 10_000], message: "Wait for the demo reset limit to clear" })
      .not.toBe(429);
  }
  if (status !== 200) throw new Error(`Failed to reset ${scenario} (HTTP ${status})`);
}

export async function analyseHero(page: Page) {
  await page.goto("/?scenario=hero");
  await expect(page.getByLabel(copy.message.th, { exact: true })).toHaveValue("คลัง A เตรียม SKU-X ให้ทันรอบบ่ายวันนี้ไม่ได้ครับ");
  await page.getByRole("button", { name: copy.analyse.th }).click();
  await expect(page.getByRole("region", { name: copy.compare.th }).getByRole("table")).toBeVisible({ timeout: 25_000 });
}
