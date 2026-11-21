import { expect, test } from "@playwright/test";
import { copy } from "../lib/copy";
import { analyseHero, resetDemo } from "./helpers";

test("the decision explains the extra warehouse cost and compares it with the operator's estimate", async ({ page, request }) => {
  await resetDemo(request);
  await analyseHero(page);
  await expect(page.getByRole("heading", { name: copy.deskHeading.th })).toBeVisible();
  await expect(page.getByText("ช่วงที่เตรียมของไม่ได้", { exact: true })).toBeVisible();
  await expect(page.locator(".blocked-time")).toContainText("ของยังไม่พร้อมส่ง");
  const comparison = page.getByRole("region", { name: copy.compare.th });
  expect((await comparison.boundingBox())?.width).toBeGreaterThan(600);
  const decision = page.getByRole("region", { name: "ผลต่างของสองแผน" });
  await expect(decision).toContainText("2 ออเดอร์เสี่ยงพลาดรอบ");
  await expect(decision).toContainText("ส่งทันเพิ่ม 1 ใบ · จ่ายเพิ่มอีก ฿56");
  await expect(decision).toContainText("ใบที่ส่งทันเพิ่มคือ #101");
  const joint = page.getByRole("article", { name: copy.joint.th });
  await expect(joint).toContainText("8 หน่วย × ฿4 = ฿32");
  await expect(joint).toContainText("8 หน่วย × ฿7 = ฿56");

  await decision.getByText("ลองคิดว่าจ่ายเพิ่มแล้วคุ้มไหม").click();
  const loss = decision.getByRole("spinbutton", { name: "ถ้า #101 พลาดรอบ คาดว่าจะเสียกี่บาท?" });
  await expect(loss).toHaveValue("");
  const planningRequests: string[] = [];
  page.on("request", req => {
    if (req.method() === "POST" && new URL(req.url()).pathname !== "/api/state") planningRequests.push(req.url());
  });
  await loss.fill("100");
  await expect(decision.getByRole("status")).toContainText("ลดค่าใช้จ่ายสุทธิได้ ฿44");
  await loss.fill("30");
  await expect(decision.getByRole("status")).toContainText("เกินค่าเสียหายที่เลี่ยงได้ ฿26");
  expect(planningRequests).toEqual([]);
  await expect(joint).toContainText("฿88");
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await comparison.boundingBox())?.width).toBeGreaterThan(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test("an inline reply is interpreted with the original report before planning", async ({ page, request }) => {
  await resetDemo(request);
  const original = "คลัง A เตรียม SKU-X ไม่ได้";
  const reply = "ตั้งแต่ 13:00 ถึง 18:00 น.";
  const interpreter = { used: "openai:test", attempts: [{ name: "openai:test", ok: true }], latency_ms: 1, rate_limited: false };
  const validation = { ok: true, issues: [] };
  const messages: string[] = [];
  await page.route("**/api/interpret", route => {
    const { message } = route.request().postDataJSON();
    messages.push(message);
    return route.fulfill({ json: messages.length === 1 ? {
      outcome: "clarification", incident: null, clarification: { about: "time", question_th: "เตรียมของไม่ได้ช่วงกี่โมงครับ?" },
      interpreter, validation,
    } : {
      outcome: "incident", clarification: null, incident: {
        warehouse_id: "A", sku_ids: ["SKU-X"], evidence_quote: original,
        window_start: "2026-11-21T13:00:00+07:00", window_end: "2026-11-21T18:00:00+07:00",
      }, interpreter, validation,
    } });
  });
  await page.goto("/?scenario=hero");
  const input = page.getByLabel(copy.message.th, { exact: true });
  await input.fill(original);
  await page.getByRole("button", { name: copy.analyse.th }).click();
  const question = page.getByRole("region", { name: copy.clarify.th });
  await expect(question).toContainText("เตรียมของไม่ได้ช่วงกี่โมงครับ?");
  await expect(page.locator("#desk-plans .score")).toHaveCount(0);
  await question.getByLabel("ตอบคำถามนี้").fill(reply);
  await question.getByRole("button", { name: "เพิ่มคำตอบแล้วเช็กใหม่" }).click();
  const facts = page.getByRole("region", { name: copy.incident.th });
  await expect(facts).toContainText("คลัง A");
  await expect(facts).toContainText("SKU-X");
  await expect(facts).toContainText("13:00–18:00");
  await expect(page.locator("#desk-plans .score")).toHaveText(["1/2", "2/2"]);
  expect(messages).toEqual([original, original + "\n" + reply]);
});
