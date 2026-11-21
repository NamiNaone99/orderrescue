import { expect, test, type Page } from "@playwright/test";
import { stateResponseSchema } from "../lib/domain/contracts";
import { copy, polishCopy } from "../lib/copy";

async function glyphFonts(page: Page, selector: string) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("DOM.enable");
    await session.send("CSS.enable");
    const { root } = await session.send("DOM.getDocument");
    const { nodeId } = await session.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    const { fonts } = await session.send("CSS.getPlatformFontsForNode", { nodeId });
    return fonts.filter(font => font.glyphCount > 0);
  } finally {
    await session.detach();
  }
}

for (const width of [1440, 390]) {
  test(`IBM Plex Sans Thai renders Thai and Latin and the demo guide preserves the draft at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto("/?scenario=hero");
    const message = page.getByLabel(copy.message.th, { exact: true });
    await expect(message).toBeEnabled();
    const draft = "ข้อความตัวอย่างสำหรับเจ้าหน้าที่";
    await message.fill(draft);
    await page.evaluate(() => document.fonts.ready);
    for (const selector of ["h1", ".wordmark [lang=en]"]) {
      const fonts = await glyphFonts(page, selector);
      expect(fonts.length).toBeGreaterThan(0);
      expect(fonts.every(font => font.isCustomFont && /IBM\s*Plex\s*Sans\s*Thai/i.test(font.familyName))).toBe(true);
    }
    const changes: string[] = [];
    page.on("request", request => { if (request.url().includes("/api/")) changes.push(request.url()); });
    const trigger = page.getByRole("button", { name: polishCopy.guide.th, exact: true });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const guide = page.getByRole("dialog", { name: polishCopy.guide.th });
    await expect(guide).toContainText("1 จาก 2 ใบ");
    await expect(guide).toContainText("2 จาก 2 ใบ");
    await expect(guide).toContainText("฿88");
    await expect(guide).toContainText("14:30");
    await page.keyboard.press("Tab");
    await expect(guide.getByRole("button", { name: polishCopy.closeGuide.th })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(guide).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(message).toHaveValue(draft);
    expect(changes).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}

test("the first paint exposes the hero sample and accepts one analysis while state is loading", async ({ page }) => {
  let release = () => {};
  const hold = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/state?scenario=hero", async route => { await hold; await route.continue(); }, { times: 1 });
  let interpretations = 0;
  page.on("request", req => { if (req.url().endsWith("/api/interpret")) interpretations++; });
  await page.goto("/?scenario=hero");
  const button = page.getByRole("button", { name: copy.analyse.th, exact: true });
  await expect(page.getByLabel(copy.message.th, { exact: true })).toHaveValue("คลัง A เตรียม SKU-X ให้ทันรอบบ่ายวันนี้ไม่ได้ครับ");
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.getByRole("button", { name: copy.analysing.th })).toBeDisabled();
  expect(interpretations).toBe(0);
  release();
  await expect(page.locator("#desk-incident mark")).toBeVisible();
  await expect(page.locator('#desk-plans[data-plan-state="ready"] .score').first()).toBeVisible();
  expect(interpretations).toBe(1);
  const counts = await page.locator("#desk-plans .score").allTextContents();
  const budget = await page.locator("#desk-budget").inputValue();
  const writes: string[] = [];
  page.on("request", req => { if (req.method() === "POST") writes.push(req.url()); });
  await page.getByRole("button", { name: polishCopy.guide.th, exact: true }).click();
  await page.getByRole("button", { name: polishCopy.closeGuide.th }).click();
  await expect(page.locator("#desk-plans .score")).toHaveText(counts);
  await expect(page.locator("#desk-budget")).toHaveValue(budget);
  expect(writes).toEqual([]);
});

test("manual entry keeps the real-day default SKU when it requires a filtered state read", async ({ page }) => {
  await page.route("**/api/state?scenario=real-day", async route => {
    const response = await route.fetch();
    const catalog = stateResponseSchema.parse(await response.json());
    const skus = catalog.skus.filter(sku => sku.id !== catalog.scenario.default_sku_id);
    await route.fulfill({ response, json: { ...catalog, skus } });
  });
  const filtered = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === "/api/state" && url.searchParams.get("scenario") === "real-day" && url.searchParams.has("sku");
  });
  await page.goto("/?scenario=real-day");
  const state = stateResponseSchema.parse(await (await filtered).json());
  const defaultSku = state.scenario.default_sku_id;
  await page.getByRole("button", { name: copy.manualEntry.th, exact: true }).click();
  const form = page.getByRole("form", { name: copy.manualEntry.th });
  await expect(form.locator(`#manual-skus option[value="${defaultSku}"]`)).toHaveCount(1);
  await form.getByRole("combobox", { name: /SKU/ }).fill(defaultSku);
  await form.getByLabel(copy.warehouse.th, { exact: true }).selectOption("A");
  await form.getByLabel(copy.windowStart.th).fill("13:00");
  await form.getByLabel(copy.windowEnd.th).fill("14:00");
  const planned = page.waitForResponse(response => new URL(response.url()).pathname === "/api/plan");
  await form.getByRole("button", { name: copy.manualPlan.th }).click();
  const response = await planned;
  expect(response.ok()).toBe(true);
  expect(response.request().postDataJSON().incident.sku_id).toBe(defaultSku);
});
