import { expect, test } from "@playwright/test";
import { copy } from "../lib/copy";
import { analyseHero, resetDemo } from "./helpers";

test("hero dispatch compares allocations and books the confirmed rows", { tag: "@smoke" }, async ({ page, request }) => {
  await resetDemo(request);
  await analyseHero(page);
  const incident = page.getByRole("region", { name: copy.incident.th });
  await expect(incident).toContainText("คลัง A");
  await expect(incident).toContainText("SKU-X");
  await expect(incident).toContainText("13:00–18:00");
  await expect(incident.locator("mark")).not.toBeEmpty();
  await expect(incident).toBeFocused();
  await expect(page.locator("#desk-announcements")).toContainText(copy.incident.th);
  const first = page.getByRole("article", { name: copy.firstCome.th });
  const joint = page.getByRole("article", { name: copy.joint.th });
  await expect(first).toContainText("1/2");
  await expect(first).toContainText("฿32");
  await expect(joint).toContainText("2/2");
  await expect(joint).toContainText("฿88");
  await page.getByRole("button", { name: copy.confirmRows.th }).click();
  const dialog = page.getByRole("dialog", { name: copy.confirmTitle.th });
  await expect(dialog.getByRole("row").filter({ hasText: "#101" })).toContainText("คลัง B");
  await expect(dialog.getByRole("row").filter({ hasText: "#102" })).toContainText("คลัง C");
  await dialog.getByRole("button", { name: copy.confirm.th, exact: true }).click();
  const receipt = page.getByRole("region", { name: copy.receipt.th });
  await expect(receipt).toContainText("฿88");
  await expect(receipt).toBeFocused();
  await expect(page.locator("#desk-announcements")).toContainText(copy.booked.th);
  for (const id of ["B","C"]) {
    const warehouse = page.getByRole("article", { name: copy.warehouse.th + " " + id, exact: true });
    await expect(warehouse.locator("dl div").filter({ hasText: copy.freeStock.th }).locator("dd")).toHaveText("0");
  }
  // Observe the complete polling interval so a booked plan never becomes stale on its own revisions.
  const staleAppeared = await page.getByText(copy.stockChanged.th, { exact: true }).waitFor({ state: "visible", timeout: 6000 })
    .then(() => true, () => false);
  expect(staleAppeared).toBe(false);
  await expect(receipt).toBeVisible();
});
