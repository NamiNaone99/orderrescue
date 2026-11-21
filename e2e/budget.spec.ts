import { expect, test } from "@playwright/test";
import { copy } from "../lib/copy";
import { analyseHero, resetDemo } from "./helpers";

test("budget presets preserve two orders at 88, prioritize #101 at 87 and serve none at 31", async ({ page, request }) => {
  await resetDemo(request);
  await analyseHero(page);
  const budget = page.getByRole("region", { name: copy.budget.th });
  const joint = page.getByRole("article", { name: copy.joint.th });
  const orders = page.getByRole("region", { name: copy.compare.th }).getByRole("table");

  await budget.getByRole("button", { name: "฿88", exact: true }).click();
  await expect(budget).toContainText(copy.remaining.th + " ฿0");
  await expect(joint).toContainText("2/2");
  await expect(joint).toContainText("฿88");

  await budget.getByRole("button", { name: "฿87", exact: true }).click();
  await expect(joint).toContainText("1/2");
  const served = orders.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "#101" }) });
  await expect(served.getByRole("cell", { name: copy.onTime.th, exact: true })).toBeVisible();
  const unserved = orders.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "#102" }) });
  await expect(unserved.getByRole("cell", { name: copy.onTime.th, exact: true })).toHaveCount(0);

  await budget.getByRole("button", { name: "฿31", exact: true }).click();
  await expect(joint).toContainText("0/2");
  await expect(budget.getByRole("button", { name: copy.confirmRows.th })).toBeDisabled();
});
