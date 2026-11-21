import AxeBuilder from "@axe-core/playwright";
import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { z } from "zod";
import { buildCopy, copy, dataCopy } from "../lib/copy";
import { resetDemo } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
});

test("shows source attribution and fields accessibly on the data page", async ({ page }) => {
  await page.goto("/data");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(dataCopy.title.th);
  const path = "data/derived/day-2011-11-22.json";
  if (existsSync(path)) {
    const { provenance } = z.object({ provenance: z.object({
      source_name: z.string(), source_url: z.url(), licence: z.string(), licence_url: z.url(),
      source_file_sha256: z.string(), fields: z.record(z.string(), z.string()),
    }) }).parse(JSON.parse(readFileSync(path, "utf8")));
    await expect(page.getByText(provenance.source_name, { exact: true })).toBeVisible();
    const licence = page.getByRole("link", { name: provenance.licence, exact: true });
    await expect(licence).toBeVisible();
    await expect(licence).toHaveAttribute("href", provenance.licence_url);
    await expect(page.getByRole("link", { name: dataCopy.original.th })).toHaveAttribute("href", provenance.source_url);
    await expect(page.getByText(provenance.source_file_sha256.slice(0, 12), { exact: true })).toBeVisible();
    const fields = page.locator(".provenance-fields");
    await expect(fields).toBeVisible();
    expect(await fields.locator("tbody th").allTextContents()).toEqual(Object.keys(provenance.fields));
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

test("traces the logged T03 prompt through its PR and planner regression on desktop and phone", async ({ page }) => {
  await page.goto("/built-with-codex");
  await expect(page.getByRole("heading", { level: 1, name: copy.built.th })).toBeVisible();
  const ledger = existsSync("docs/CODEX_LOG.md") ? readFileSync("docs/CODEX_LOG.md", "utf8") : "";
  const expected = ledger.split(/\r?\n/).filter(line => /^\|\s*\d{2}:\d{2}\s*\|/.test(line));
  // The server-rendered test covers the empty notice on a ledger-free build.
  if (!/^\|\s*Time\s*\|\s*Task\s*\|/m.test(ledger) || expected.length === 0) return;
  await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(expected.length);
  await expect(page.getByRole("img", { name: new RegExp(buildCopy.architecture.th) })).toBeVisible();
  const study = page.locator(".evidence-example");
  const review = readFileSync("docs/codex-log/T03.md", "utf8").split(/\r?\n/).find(line => line.startsWith("| `codex review --uncommitted` |"));
  if (review) await expect(study).toContainText(review.split("|")[2].trim());
  const prompt = readFileSync("docs/CODEX_TASKS.md", "utf8").split("## T03 ")[1].split("```")[1].trim().replaceAll("\r\n", "\n");
  await study.locator("summary").focus();
  await page.keyboard.press("Enter");
  expect(await study.locator("pre").innerText()).toBe(prompt);
  await expect(study.getByRole("link", { name: "PR #1" })).toHaveAttribute("href", /\/pull\/1$/);
  await expect(study.getByRole("link", { name: buildCopy.regression.th })).toHaveAttribute("href", /\/tests\/planner\/solver\.test\.ts$/);
  await page.keyboard.press("Enter");
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(result.violations).toEqual([]);
  }
});
