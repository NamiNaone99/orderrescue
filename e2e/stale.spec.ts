import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { copy } from "../lib/copy";
import { errorResponseSchema, planResponseSchema, reservationResponseSchema, stateResponseSchema, type ReservationResponse } from "../lib/domain/contracts";
import { resetDemo } from "./helpers";

test("stale hero plan names the slip and requires an explicit replan", { tag: "@smoke" }, async ({ page, request }) => {
  await resetDemo(request);
  await page.goto("/?scenario=hero");
  const joint = page.getByRole("article", { name: copy.joint.th });
  let plans = 0;
  page.on("request", r => { if (new URL(r.url()).pathname === "/api/plan") plans++; });
  await page.getByRole("button", { name: copy.analyse.th }).click();
  await expect(joint).toContainText("2/2");
  await page.getByRole("button", { name: "คลัง B แจ้งของพร้อมช้าเป็น 14:30" }).click();
  const banner = page.getByRole("region", { name: copy.stockChanged.th });
  await expect(banner).toBeVisible({ timeout: 5000 });
  await expect(banner).toContainText("คลัง B");
  await expect(banner).toContainText("13:30 → 14:30");
  const replan = banner.getByRole("button", { name: copy.replan.th });
  await expect(replan).toBeFocused();
  await expect(page.locator("#desk-announcements")).toContainText(copy.stockChanged.th);
  const confirm = page.getByRole("button", { name: copy.confirmRows.th });
  await expect(confirm).toBeDisabled();
  expect(plans).toBe(1);
  await replan.click();
  await expect(banner).toHaveCount(0);
  await expect(joint).toContainText("1/2");
  await expect(joint).toContainText("฿32");
  const rows = page.locator(".order-table");
  await expect(rows.getByRole("row").filter({ hasText: "#101" })).toContainText(copy.noSource.th);
  await expect(rows.getByRole("row").filter({ hasText: "#102" }).locator('td[data-label="' + copy.joint.th + '"]')).toHaveText("B");
  await expect(confirm).toBeEnabled();
  expect(plans).toBe(2);
});

test("outdated expected revision through the reservation API returns 409 without changing a row", async ({ request }) => {
  await resetDemo(request);
  const input = { scenario: "hero", budget_thb: 100, incident: { warehouse_id: "A", sku_id: "SKU-X",
    window_start: "2026-11-21T13:00:00+07:00", window_end: "2026-11-21T18:00:00+07:00" } };
  const planned = await request.post("/api/plan", { data: input });
  expect(planned.status()).toBe(200);
  const plan = planResponseSchema.parse(await planned.json());
  const lines = plan.joint.lines.map(({ order_id, sku_id, warehouse_id, qty, unit_cost_thb, expected_revision }) =>
    ({ order_id, sku_id, warehouse_id, qty, unit_cost_thb, expected_revision }));
  expect((await request.post("/api/demo/event", { data: { scenario: "hero", event_id: "b-slips-1430" } })).status()).toBe(200);
  const path = "/api/state?scenario=hero&sku=SKU-X";
  const before = stateResponseSchema.parse(await (await request.get(path)).json());
  const booked = await request.post("/api/reservations", {
    data: { ...input, lines, plan_hash: plan.plan_hash, idempotency_key: randomUUID() },
  });
  expect(booked.status()).toBe(409);
  expect(errorResponseSchema.parse(await booked.json()).error.code).toBe("STALE_STOCK");
  expect(stateResponseSchema.parse(await (await request.get(path)).json())).toEqual(before);
});

for (const failure of ["connection reset", "storage 503"] as const) {
  test(`an uncertain confirmation keeps its key while a poll observes the booking (${failure})`, async ({ page, request }) => {
    await resetDemo(request);
    await page.goto("/");
    await page.getByRole("button", { name: copy.analyse.th }).click();
    await page.getByRole("button", { name: copy.confirmRows.th }).click();
    const dialog = page.getByRole("dialog");
    const submit = dialog.getByRole("button", { name: copy.confirm.th, exact: true });
    const bodies: (string | null)[] = [];
    const results: ReservationResponse[] = [];
    await page.route("**/api/reservations", async route => {
      bodies.push(route.request().postData());
      const response = await route.fetch();
      results.push(reservationResponseSchema.parse(await response.json()));
      if (results.length === 1) {
        expect(response.status()).toBe(201);
        if (failure === "connection reset") {
          await route.abort("connectionreset");
        } else {
          await route.fulfill({ status: 503, json: { error: {
            code: "STORAGE_UNAVAILABLE", message: "Storage unavailable", request_id: randomUUID(),
          } } });
        }
      } else {
        expect(response.status()).toBe(200);
        await route.fulfill({ response });
      }
    });
    await submit.click();
    // Observe the committed rows via a successful state poll before retrying the original key.
    const stockRow = page.locator('.stock-row[aria-label="' + copy.warehouse.th + ' B"]');
    await expect(stockRow.locator("dl div").filter({ hasText: copy.freeStock.th }).locator("dd")).toHaveText("0", { timeout: 7000 });
    await expect(dialog.getByRole("alert")).toContainText(failure === "storage 503" ? copy.degraded.th : copy.requestFailed.th);
    await expect(submit).toBeEnabled();
    await submit.click();
    const receipt = page.locator("#desk-receipt");
    await expect(receipt).toContainText(copy.replayed.th);
    await expect(receipt).toBeFocused();
    await expect(page.locator("#desk-announcements")).toContainText(copy.replayed.th);
    await expect(page.locator("#stale-replan")).toHaveCount(0);
    expect(results).toHaveLength(2);
    expect(results[0].replayed).toBe(false);
    expect(results[1]).toEqual({ receipt: results[0].receipt, replayed: true });
    expect(bodies[0]).toBeTruthy();
    expect(bodies[1]).toBe(bodies[0]);
    const state = stateResponseSchema.parse(await (await request.get("/api/state?scenario=hero&sku=SKU-X")).json());
    expect(state.reservations.map(item => item.id)).toEqual([results[0].receipt.id]);
  });
}
