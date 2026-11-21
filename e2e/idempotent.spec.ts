import { expect, test, type APIRequestContext } from "@playwright/test";
import { copy } from "../lib/copy";
import { reservationRequestSchema, reservationResponseSchema, stateResponseSchema } from "../lib/domain/contracts";
import { analyseHero, resetDemo } from "./helpers";

async function heroState(request: APIRequestContext) {
  const response = await request.get("/api/state?scenario=hero&sku=SKU-X");
  expect(response.status()).toBe(200);
  return stateResponseSchema.parse(await response.json());
}

test("double-clicking confirmation and replaying its request creates one reservation", async ({ page, request }) => {
  await resetDemo(request);
  await analyseHero(page);
  await page.getByRole("button", { name: copy.confirmRows.th }).click();
  const dialog = page.getByRole("dialog", { name: copy.confirmTitle.th });
  const created = page.waitForResponse(response =>
    new URL(response.url()).pathname === "/api/reservations" && response.request().method() === "POST" && response.status() === 201);
  await dialog.getByRole("button", { name: copy.confirm.th, exact: true }).dblclick();
  const response = await created;
  const original = reservationRequestSchema.parse(response.request().postDataJSON());
  const booked = reservationResponseSchema.parse(await response.json());
  expect(booked.replayed).toBe(false);
  expect(booked.receipt.idempotency_key).toBe(original.idempotency_key);
  const receipt = page.getByRole("region", { name: copy.receipt.th });
  await expect(receipt).toContainText(booked.receipt.id.slice(0, 8));
  const beforeReplay = await heroState(request);
  expect(beforeReplay.reservations.map(row => row.id)).toEqual([booked.receipt.id]);

  const repeated = await request.post("/api/reservations", { data: original });
  expect(repeated.status()).toBe(200);
  expect(reservationResponseSchema.parse(await repeated.json())).toEqual({ replayed: true, receipt: booked.receipt });
  const afterReplay = await heroState(request);
  expect(afterReplay.reservations).toEqual(beforeReplay.reservations);
  expect(afterReplay.stock).toEqual(beforeReplay.stock);
  expect(afterReplay.state_version).toBe(beforeReplay.state_version);
});
