import { expect, test } from "@playwright/test";
import { copy } from "../lib/copy";
import { interpretResponseSchema } from "../lib/domain/contracts";
import { resetDemo } from "./helpers";

test("an ambiguous warehouse message asks for clarification and leaves no plan to book", async ({ page, request }) => {
  await resetDemo(request);
  await page.goto("/?scenario=hero");
  await page.getByRole("button", { name: "ข้อมูลไม่ครบ", exact: true }).click();
  await expect(page.getByLabel(copy.message.th, { exact: true })).toHaveValue("ของตัวนั้นหยิบไม่ได้นะบ่ายนี้");
  const response = page.waitForResponse(reply => new URL(reply.url()).pathname === "/api/interpret" && reply.request().method() === "POST");
  await page.getByRole("button", { name: copy.analyse.th }).click();
  const reply = await response;
  expect(reply.status()).toBe(200);
  const answer = interpretResponseSchema.parse(await reply.json());
  expect(answer.outcome).toBe("clarification");
  if (!answer.clarification) throw new Error("Expected a clarification question");
  const card = page.getByRole("region", { name: copy.clarify.th });
  await expect(card.getByText(answer.clarification.question_th, { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: copy.incident.th })).toHaveCount(0);
  await expect(page.getByRole("region", { name: copy.compare.th }).getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("button", { name: copy.confirmRows.th, disabled: false })).toHaveCount(0);
});
