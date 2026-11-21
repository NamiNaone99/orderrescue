import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { POST as postPlan } from "@/app/api/plan/route";
import { POST as postReservation } from "@/app/api/reservations/route";
import {
  errorResponseSchema, planResponseSchema, reservationResponseSchema,
  type ErrorCode, type PlanRequest, type PlanResponse, type ReservationRequest,
} from "@/lib/domain/contracts";
import * as planner from "@/lib/planner";
import { planHash } from "@/lib/planner/hash";
import { heroTime } from "@/lib/scenarios/hero";
import { getStore } from "@/lib/store";
import { StoreError } from "@/lib/store/types";

const input: PlanRequest = {
  scenario: "hero",
  incident: { warehouse_id: "A", sku_id: "SKU-X", window_start: heroTime("13:00"), window_end: heroTime("18:00") },
  budget_thb: 100,
};

function post(path: "plan" | "reservations", body: unknown) {
  const request = new Request(`http://localhost/api/${path}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  return path === "plan" ? postPlan(request) : postReservation(request);
}

async function readPlan() {
  const response = await post("plan", input);
  expect(response.status).toBe(200);
  z.uuid().parse(response.headers.get("x-request-id"));
  return planResponseSchema.parse(await response.json());
}

function confirm(plan: PlanResponse): ReservationRequest {
  return {
    ...input, idempotency_key: randomUUID(), plan_hash: plan.plan_hash,
    lines: plan.joint.lines.map(({ order_id, sku_id, warehouse_id, qty, unit_cost_thb, expected_revision }) =>
      ({ order_id, sku_id, warehouse_id, qty, unit_cost_thb, expected_revision })),
  };
}

async function expectError(response: Response, status: number, code: ErrorCode) {
  expect(response.status).toBe(status);
  const { error } = errorResponseSchema.parse(await response.json());
  expect(error.code).toBe(code);
  expect(error.request_id).toBe(response.headers.get("x-request-id"));
  return error;
}

beforeEach(async () => {
  vi.stubGlobal("orderRescuePlanningBucket", undefined);
  vi.stubEnv("STORAGE_MODE", "memory");
  vi.spyOn(console, "info").mockImplementation(() => {});
  await getStore().reset("hero");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("serves the plan from fallback memory and refuses to book there when Supabase is unavailable", async () => {
  const memory = getStore();
  const before = await memory.getSnapshot("hero");
  vi.stubEnv("SUPABASE_URL", undefined);
  vi.stubEnv("SUPABASE_SECRET_KEY", undefined);
  vi.stubEnv("STORAGE_MODE", "supabase");
  const request = confirm(await readPlan());
  await expectError(await post("reservations", request), 503, "STORAGE_UNAVAILABLE");
  expect(await memory.getSnapshot("hero")).toEqual(before);
});

it("returns the two hero allocations, confirmation hash and current revision hash", async () => {
  const result = await readPlan();
  const seed = await getStore().getSnapshot("hero");
  expect(result).toMatchObject({
    budget_thb: 100, state_version: seed.state_version,
    first_come: { total: 2, on_time: 1, extra_cost_thb: 32, lines: [{ order_id: "102", warehouse_id: "B" }] },
    joint: {
      total: 2, on_time: 2, extra_cost_thb: 88,
      lines: [{ order_id: "101", warehouse_id: "B" }, { order_id: "102", warehouse_id: "C" }],
    },
  });
  expect(result.plan_hash).toBe(planHash(input.scenario, input.incident, input.budget_thb, result.joint.lines));
});

it("accepts the six confirmable fields, creates one receipt, then replays it", async () => {
  const request = confirm(await readPlan());
  const fresh = await post("reservations", request);
  expect(fresh.status).toBe(201);
  z.uuid().parse(fresh.headers.get("x-request-id"));
  const saved = reservationResponseSchema.parse(await fresh.json());
  expect(JSON.parse(vi.mocked(console.info).mock.lastCall?.[0])).toEqual({
    request_id: fresh.headers.get("x-request-id"), method: "POST", status: 201, receipt_id: saved.receipt.id,
  });
  expect(saved).toMatchObject({
    receipt: { idempotency_key: request.idempotency_key, total_extra_cost_thb: 88, lines: request.lines },
    replayed: false,
  });
  const replay = await post("reservations", request);
  expect(replay.status).toBe(200);
  z.uuid().parse(replay.headers.get("x-request-id"));
  expect(reservationResponseSchema.parse(await replay.json())).toEqual({ receipt: saved.receipt, replayed: true });
  expect((await getStore().getSnapshot("hero")).reservations).toHaveLength(1);
});

it("carries NO_AFFECTED_ORDERS as a successful empty plan after both orders are booked", async () => {
  expect((await post("reservations", confirm(await readPlan()))).status).toBe(201);
  const result = await readPlan();
  expect(result.affected).toEqual([]);
  for (const strategy of [result.first_come, result.joint]) {
    expect(strategy).toEqual({ total: 0, on_time: 0, extra_cost_thb: 0, lines: [], needs_human: [] });
  }
});

it("rejects a tampered warehouse before calling the store", async () => {
  const request = confirm(await readPlan());
  request.lines[0].warehouse_id = "C";
  const reserve = vi.spyOn(getStore(), "reserve");
  await expectError(await post("reservations", request), 422, "PLAN_HASH_MISMATCH");
  expect(reserve).not.toHaveBeenCalled();
});

it("checks a matching hash against the submitted budget before calling the store", async () => {
  const request = confirm(await readPlan());
  request.budget_thb = 87;
  request.plan_hash = planHash(request.scenario, request.incident, request.budget_thb, request.lines);
  const reserve = vi.spyOn(getStore(), "reserve");
  await expectError(await post("reservations", request), 422, "OVER_BUDGET");
  expect(reserve).not.toHaveBeenCalled();
});

it("refuses the original rows after a revision changes without substituting another plan", async () => {
  const request = confirm(await readPlan());
  await getStore().applyDemoEvent("hero", "b-slips-1430");
  const before = await getStore().getSnapshot("hero");
  await expectError(await post("reservations", request), 409, "STALE_STOCK");
  expect(await getStore().getSnapshot("hero")).toEqual(before);
});

it("distinguishes reuse of a key with a new hash from a new key on an already booked order", async () => {
  const request = confirm(await readPlan());
  expect((await post("reservations", request)).status).toBe(201);
  const changed = { ...request, budget_thb: 88 };
  changed.plan_hash = planHash(changed.scenario, changed.incident, changed.budget_thb, changed.lines);
  await expectError(await post("reservations", changed), 409, "IDEMPOTENCY_CONFLICT");
  await expectError(await post("reservations", { ...request, idempotency_key: randomUUID() }), 409, "ORDER_ALREADY_RESERVED");
});

it("rejects the display-only time fields when confirming a plan", async () => {
  const result = await readPlan();
  await expectError(await post("reservations", { ...confirm(result), lines: result.joint.lines }), 422, "INVALID_INPUT");
});

it("rejects an incident with a SKU absent from the scenario", async () => {
  const incident = { ...input.incident, sku_id: "unknown" };
  await expectError(await post("plan", { ...input, incident }), 422, "INVALID_INPUT");
});

it("allows 60 affected orders and rejects 61 before running the search", async () => {
  const store = getStore();
  const seed = await store.getSnapshot("hero");
  const orders = Array.from({ length: 61 }, (_, index) => ({ ...seed.orders[0], id: String(index + 1) }));
  const snapshot = { ...seed, orders, order_lines: orders.map(({ id }) => ({ order_id: id, sku_id: "SKU-X", qty: 8 })) };
  const read = vi.spyOn(store, "getSnapshot").mockResolvedValueOnce(snapshot);
  const search = vi.spyOn(planner, "plan");
  await expectError(await post("plan", { ...input, budget_thb: 0 }), 422, "INVALID_INPUT");
  expect(search).not.toHaveBeenCalled();
  const withReserved = orders.map((order, index) => index === 0 ? { ...order, status: "reserved" as const } : order);
  read.mockResolvedValueOnce({ ...snapshot, orders: withReserved });
  const response = await post("plan", { ...input, budget_thb: 0 });
  expect(response.status).toBe(200);
  expect(planResponseSchema.parse(await response.json()).affected).toHaveLength(60);
});

it("reports an unavailable booking store without leaking the provider diagnostic", async () => {
  const request = confirm(await readPlan());
  const detail = "private provider diagnostic";
  vi.spyOn(getStore(), "reserve").mockRejectedValueOnce(new StoreError("STORAGE_UNAVAILABLE", detail));
  const error = await expectError(await post("reservations", request), 503, "STORAGE_UNAVAILABLE");
  expect(error.message).not.toContain(detail);
});

it("maps an unexpected snapshot read failure to a safe INTERNAL error", async () => {
  const detail = "private internal diagnostic";
  vi.spyOn(getStore(), "getSnapshot").mockRejectedValueOnce(new Error(detail));
  const error = await expectError(await post("plan", input), 500, "INTERNAL");
  expect(error.message).not.toContain(detail);
});
