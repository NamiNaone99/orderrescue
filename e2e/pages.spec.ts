import AxeBuilder from "@axe-core/playwright";
import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { z } from "zod";
import { dataCopy } from "../lib/copy";

test("shows source attribution and fields accessibly on the data page", async ({ page }) => {
  await page.goto("/data");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(dataCopy.title.th);
  const path = "data/derived/day-2011-11-22.json";
  if (existsSync(path)) {
    const { provenance } = z.object({ provenance: z.object({
      source_url: z.url(), source_file_sha256: z.string(), fields: z.record(z.string(), z.string()),
    }) }).parse(JSON.parse(readFileSync(path, "utf8")));
    await expect(page.getByRole("link", { name: dataCopy.original.th })).toHaveAttribute("href", provenance.source_url);
    await expect(page.getByText(provenance.source_file_sha256.slice(0, 12), { exact: true })).toBeVisible();
    expect(await page.locator(".provenance-fields tbody th").allTextContents()).toEqual(Object.keys(provenance.fields));
    await expect(page.getByText(dataCopy.modified.en, { exact: true })).toBeVisible();
  } else {
    await expect(page.getByText(dataCopy.absent.en, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: dataCopy.original.th })).toHaveCount(0);
  }
  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(result.violations).toEqual([]);
  }
});
