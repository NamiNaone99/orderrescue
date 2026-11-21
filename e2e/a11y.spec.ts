import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { copy } from "../lib/copy";
import { analyseHero, resetDemo } from "./helpers";

const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`planned desk and confirmation dialog meet WCAG A/AA at ${viewport.width}px`, async ({ page, request }) => {
    await resetDemo(request);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await analyseHero(page);
    await expect(page.getByRole("article", { name: copy.joint.th })).toContainText("2/2");
    await page.evaluate(() => document.fonts.ready);
    const planned = await new AxeBuilder({ page }).withTags(tags).analyze();
    expect(planned.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(n => n.target) }))).toEqual([]);

    const review = page.getByRole("button", { name: copy.confirmRows.th });
    await review.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: copy.confirmTitle.th });
    await expect(dialog).toBeVisible();
    const confirmed = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(tags).analyze();
    expect(confirmed.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(n => n.target) }))).toEqual([]);

    const cancel = dialog.getByRole("button", { name: copy.cancel.th });
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("button", { name: copy.confirm.th, exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(review).toBeFocused();
  });
}
