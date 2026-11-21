import { expect } from "@playwright/test";
import { test } from "./smoke-test";

test("home page loads and has a title", { tag: "@smoke" }, async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/\S/);
});
