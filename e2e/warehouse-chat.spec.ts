import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { heroFollowups } from "../lib/domain/chat-samples";
import { chatCopy } from "../lib/copy";
import { resetDemo } from "./helpers";

test("a warehouse message opens the outage, then a confirmed delay makes the 2/2 plan stale and replans to 1/2", async ({
  page,
  request,
}) => {
  await resetDemo(request);
  await page.goto("/?scenario=hero");
  const feed = page.locator("#warehouse-chat");
  const draft = feed.locator("#chat-message"),
    read = feed.locator("#chat-read");
  await feed.locator("#chat-sender").selectOption("A");
  await draft.fill("คลัง A เตรียม SKU-X ให้ทันรอบบ่ายวันนี้ไม่ได้ครับ");
  await read.click();
  const scores = page.locator("#desk-plans .score");
  await expect(scores).toHaveText(["1/2", "2/2"]);
  await expect(feed.locator("li").first().locator("header strong")).toHaveText("คลัง A");
  await feed.locator('[data-chat-sample="delay"]').click();
  await expect(draft).toHaveValue(heroFollowups[0].text);
  const writes: string[] = [];
  page.on("request", (req) => {
    if (new URL(req.url()).pathname === "/api/chat/apply") writes.push(req.method());
  });
  await read.click();
  const proposed = feed.locator('[data-chat-apply="delay"]');
  await expect(proposed).toBeVisible();
  await expect(feed.locator(".chat-proposal")).toContainText("14:30");
  await expect(feed.locator("q")).toHaveText(heroFollowups[0].text);
  await expect(feed.locator("li").last().locator("header strong")).toHaveText("คลัง B");
  expect(writes).toEqual([]);
  await expect(page.locator("#stale-replan")).toHaveCount(0);
  for (const size of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const axe = await new AxeBuilder({ page })
      .include("#warehouse-chat")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
  }
  await proposed.click();
  await expect(feed.getByText(chatCopy.applied.th)).toBeVisible();
  expect(writes).toEqual(["POST"]);
  await expect(page.locator("#stale-replan")).toBeVisible();
  await page.locator("#stale-replan").click();
  await expect(scores).toHaveText(["1/2", "1/2"]);
  await expect(page.locator("#stale-replan")).toHaveCount(0);
  await expect(feed.locator("li")).toHaveCount(2);
});
