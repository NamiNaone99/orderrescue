import { expect, test, type Page } from "@playwright/test";
import { copy } from "../lib/copy";
import { resetDemo } from "./helpers";

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });

async function fitsPhone(page: Page) {
  const size = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth,
  }));
  expect(size.viewport).toBe(390);
  expect(size.scroll).toBeLessThanOrEqual(size.viewport);
}

test("phone dispatches the two hero orders without horizontal page scrolling", async ({ page, request }) => {
  await resetDemo(request);
  await page.goto("/?scenario=hero");
  const analyse = page.getByRole("button", { name: copy.analyse.th });
  await expect(analyse).toBeEnabled();
  await fitsPhone(page);
  await analyse.tap();
  const joint = page.getByRole("article", { name: copy.joint.th });
  await expect(joint).toContainText("2/2", { timeout: 25_000 });
  await expect(joint).toContainText("฿88");
  const firstCome = page.getByRole("article", { name: copy.firstCome.th });
  await expect(firstCome).toContainText("1/2");
  await expect(firstCome).toContainText("฿32");
  const incident = page.getByRole("region", { name: copy.incident.th });
  await expect(incident).toContainText("SKU-X");
  await expect(incident.locator("mark")).not.toBeEmpty();
  await fitsPhone(page);
  await page.getByRole("button", { name: copy.confirmRows.th }).tap();
  const dialog = page.getByRole("dialog", { name: copy.confirmTitle.th });
  await expect(dialog.getByRole("row").filter({ hasText: "#101" })).toContainText("คลัง B");
  await expect(dialog.getByRole("row").filter({ hasText: "#102" })).toContainText("คลัง C");
  await fitsPhone(page);
  await dialog.getByRole("button", { name: copy.confirm.th, exact: true }).tap();
  const receipt = page.getByRole("region", { name: copy.receipt.th });
  await expect(receipt).toContainText("฿88");
  await expect(receipt).toBeFocused();
  for (const warehouseId of ["B", "C"]) {
    const warehouse = page.getByRole("article", { name: copy.warehouse.th + " " + warehouseId, exact: true });
    await expect(warehouse.locator("dl div").filter({ hasText: copy.freeStock.th }).locator("dd")).toHaveText("0");
  }
  await fitsPhone(page);
});
