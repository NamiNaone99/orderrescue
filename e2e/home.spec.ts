import { expect, test } from "@playwright/test";
import { resetDemo } from "./helpers";

test("home page loads and has a title", { tag: "@smoke" }, async ({ page, request }) => {
  await resetDemo(request);
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/\S/);
});
