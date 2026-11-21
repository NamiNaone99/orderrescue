import { expect, test } from "@playwright/test";
import { copy } from "../lib/copy";
import { reservationResponseSchema } from "../lib/domain/contracts";
import { analyseHero, resetDemo } from "./helpers";

test("a restored receipt keeps its stock current and never repeats the booking", async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await resetDemo(request);
  await analyseHero(page);
  await page.getByRole("button", { name: copy.confirmRows.th }).click();
  const posted = page.waitForResponse(r => new URL(r.url()).pathname === "/api/reservations");
  await page.getByRole("dialog").getByRole("button", { name: copy.confirm.th, exact: true }).click();
  const response = await posted;
  expect(response.status()).toBe(201);
  const { receipt } = reservationResponseSchema.parse(await response.json());
  expect(receipt.lines).toHaveLength(2);
  await expect(page.locator("#desk-receipt")).toContainText(receipt.id.slice(0, 8));

  await page.evaluate(id => window.history.replaceState(null, "", "/?scenario=hero&receipt=" + id), receipt.id);
  const writes: string[] = [];
  const reads: URL[] = [];
  page.on("request", req => {
    const url = new URL(req.url());
    if (url.pathname === "/api/state") reads.push(url);
    if (url.pathname.startsWith("/api/") && req.method() === "POST") writes.push(url.pathname);
  });
  await page.reload();
  const saved = page.locator("#desk-receipt");
  await expect(saved).toContainText(receipt.id.slice(0, 8));
  const receiptText = await saved.innerText();
  const row = page.locator('.stock-row[aria-label="คลัง B"]');
  await expect(row).toContainText("13:30");
  const before = reads.length;
  // Another desk applies the actual event; the receipt page only reads inventory.
  const delay = await request.post("/api/demo/event", { data: { scenario: "hero", event_id: "b-slips-1430" } });
  expect(delay.status()).toBe(200);
  await expect(row).toContainText("14:30", { timeout: 8_000 });
  expect(reads.slice(before).some(url => url.searchParams.get("sku") === receipt.lines[0].sku_id)).toBe(true);
  expect(await saved.innerText()).toBe(receiptText);
  await expect(page.locator(".stale-banner")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(row).toContainText("14:30");
  await expect(saved).toContainText(receipt.id.slice(0, 8));
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(writes).toEqual([]);
});
