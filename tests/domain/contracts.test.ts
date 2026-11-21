import { describe, expect, it } from "vitest";
import {
  demoEventRequestSchema, demoEventResponseSchema, demoResetRequestSchema, demoResetResponseSchema,
  errorResponseSchema, healthRequestSchema, healthResponseSchema, interpretRequestSchema,
  interpretResponseSchema, planRequestSchema, planResponseSchema, reservationRequestSchema,
  reservationResponseSchema, stateRequestSchema, stateResponseSchema,
  stockRowSchema,
} from "@/lib/domain/contracts";
import { heroSampleMessages, heroSnapshot } from "@/lib/scenarios/hero";

const incident = {
  warehouse_id: "A", sku_id: "SKU-X",
  window_start: "2026-11-21T13:00:00+07:00", window_end: "2026-11-21T18:00:00+07:00",
};
const plan = { scenario: "hero", incident, budget_thb: 100 };
const line = {
  order_id: "101", sku_id: "SKU-X", warehouse_id: "B",
  qty: 8, unit_cost_thb: 4, expected_revision: 1,
};
const timedLine = {
  ...line, ready_at: "2026-11-21T13:30:00+07:00", deadline_at: "2026-11-21T14:00:00+07:00",
};
const planHash = "a".repeat(64);
const requestId = "00000000-0000-4000-8000-000000000001";
const booking = { ...plan, lines: [line], idempotency_key: requestId, plan_hash: planHash };
const receipt = {
  id: requestId, created_at: "2026-11-21T12:30:00+07:00", lines: [line],
  idempotency_key: requestId, plan_hash: planHash, total_extra_cost_thb: 32,
};
const message = "คลัง A งดหยิบ SKU-X รอบบ่ายวันนี้";
const interpretation = {
  outcome: "incident",
  incident: {
    warehouse_id: "A", sku_ids: ["SKU-X"], window_start: incident.window_start,
    window_end: incident.window_end, evidence_quote: "งดหยิบ SKU-X รอบบ่ายวันนี้",
  },
  clarification: null,
  interpreter: { used: "offline", attempts: [{ name: "offline", ok: true }], latency_ms: 0, rate_limited: false },
  validation: { ok: true, issues: [] },
};

describe("API requests", () => {
  it("accepts the documented inputs for each route", () => {
    expect(healthRequestSchema.parse({})).toEqual({});
    expect(stateRequestSchema.parse({ scenario: "hero" })).toEqual({ scenario: "hero" });
    expect(stateRequestSchema.parse({ scenario: "real-day", sku: "23084" }).sku).toBe("23084");
    expect(interpretRequestSchema.parse({ scenario: "hero", message: ` ${message} ` }).message).toBe(message);
    expect(planRequestSchema.parse({ ...plan, budget_thb: 0 }).budget_thb).toBe(0);
    expect(reservationRequestSchema.parse(booking)).toEqual(booking);
    expect(demoEventRequestSchema.parse({ scenario: "hero", event_id: "b-slips-1430" }).event_id).toBe("b-slips-1430");
    for (const body of [{}, { scenario: "hero" }, { scenario: "real-day" }]) {
      expect(demoResetRequestSchema.parse(body)).toEqual(body);
    }
  });

  it.each([
    ["omitted offset", "2026-11-21T13:00:00"],
    ["UTC offset", "2026-11-21T06:00:00Z"],
    ["other offset", "2026-11-21T13:00:00+08:00"],
    ["impossible calendar date", "2026-02-30T13:00:00+07:00"],
    ["impossible clock time", "2026-11-21T25:00:00+07:00"],
    ["start equals end", incident.window_end],
    ["start after end", "2026-11-21T18:01:00+07:00"],
  ])("refuses %s in planning and booking", (_, window_start) => {
    const badIncident = { ...incident, window_start };
    expect(planRequestSchema.safeParse({ ...plan, incident: badIncident }).success).toBe(false);
    expect(reservationRequestSchema.safeParse({ ...booking, incident: badIncident }).success).toBe(false);
  });

  it.each([0, -1, 1.5, "8"])("rejects booking quantity %s", (qty) => {
    expect(reservationRequestSchema.safeParse({ ...booking, lines: [{ ...line, qty }] }).success).toBe(false);
  });

  it.each([-1, 1.5, "100"])("rejects budget %s", (budget_thb) => {
    expect(planRequestSchema.safeParse({ ...plan, budget_thb }).success).toBe(false);
  });

  it("enforces the trimmed message length at both boundaries", () => {
    for (const valid of ["x", "x".repeat(500)]) {
      expect(interpretRequestSchema.safeParse({ scenario: "hero", message: valid }).success).toBe(true);
    }
    for (const invalid of [" ", "x".repeat(501)]) {
      expect(interpretRequestSchema.safeParse({ scenario: "hero", message: invalid }).success).toBe(false);
    }
  });

  it("rejects unrecognised keys, scenarios and malformed booking identifiers", () => {
    expect(demoResetRequestSchema.safeParse({ token: "body" }).success).toBe(false);
    expect(demoEventRequestSchema.safeParse({ scenario: "hero", event_id: "b-slips-1430", ready_at: line }).success).toBe(false);
    expect(stateRequestSchema.safeParse({ scenario: "unknown" }).success).toBe(false);
    expect(planRequestSchema.safeParse({ ...plan, incident: { ...incident, source_message: message } }).success).toBe(false);
    for (const edits of [
      { lines: [timedLine] }, { lines: [] }, { lines: [{ ...line, unit_cost_thb: -4 }] },
      { idempotency_key: "101" }, { plan_hash: planHash.toUpperCase() }, { plan_hash: "a" },
    ]) {
      expect(reservationRequestSchema.safeParse({ ...booking, ...edits }).success).toBe(false);
    }
  });
});

describe("API responses", () => {
  it("distinguishes health modes, demo actions and error identifiers", () => {
    const health = { ok: true, storage: "memory", interpreter: "offline", model: null, degraded: false, commit: "dev" };
    expect(healthResponseSchema.parse(health)).toEqual(health);
    expect(healthResponseSchema.safeParse({ ...health, interpreter: "openai", model: "gpt-6-luna" }).success).toBe(true);
    expect(healthResponseSchema.safeParse({ ...health, interpreter: "openai" }).success).toBe(false);
    expect(demoEventResponseSchema.safeParse({ applied: true, state_version: "v1" }).success).toBe(true);
    expect(demoResetResponseSchema.safeParse({ ok: true }).success).toBe(true);
    const error = { code: "STALE_STOCK", message: "Stock changed", request_id: requestId };
    expect(errorResponseSchema.parse({ error }).error.code).toBe("STALE_STOCK");
    for (const edits of [{ code: "NO_AFFECTED_ORDERS" }, { code: "INTERPRETER_UNAVAILABLE" }, { request_id: "101" }]) {
      expect(errorResponseSchema.safeParse({ error: { ...error, ...edits } }).success).toBe(false);
    }
  });

  it("validates the outcome and the matching nullable payloads", () => {
    expect(interpretResponseSchema.parse(interpretation)).toEqual(interpretation);
    expect(interpretResponseSchema.safeParse({ ...interpretation, outcome: "ignore", incident: null }).success).toBe(true);
    const clarification = { about: "time", question_th: "ช่วงเวลาใดคะ?" };
    expect(interpretResponseSchema.safeParse({ ...interpretation, outcome: "clarification", incident: null, clarification }).success).toBe(true);
    expect(interpretResponseSchema.safeParse({ ...interpretation, outcome: "ignore" }).success).toBe(false);
    expect(interpretResponseSchema.safeParse({ ...interpretation, incident: { ...interpretation.incident, sku_ids: [] } }).success).toBe(false);
  });

  it("keeps state projections strict, including the public sample messages and computed stock", () => {
    const { scenario, warehouses, skus, stock, orders, order_lines } = heroSnapshot;
    const state = {
      scenario, warehouses, skus,
      stock: stock.map((row) => ({ ...row, free: row.on_hand - row.committed })),
      orders: orders.map(({ id, received_at, deadline_at, status, home_warehouse_id }) => ({
        id, received_at, deadline_at, status, home_warehouse_id,
        lines: order_lines.filter((line) => line.order_id === id).map(({ sku_id, qty }) => ({ sku_id, qty })),
      })),
      reservations: [], state_version: "v1",
    };
    expect(stateResponseSchema.parse(state)).toEqual(state);
    expect(stockRowSchema.safeParse({ ...stock[0], on_hand: 0 }).success).toBe(false);
    expect(stateResponseSchema.safeParse({ ...state, stock: [{ ...state.stock[0], free: 0 }] }).success).toBe(false);
    expect(stateResponseSchema.safeParse({
      ...state, scenario: { ...scenario, sample_messages: heroSampleMessages },
    }).success).toBe(false);
  });

  it("requires display times on planned lines and the six submitted fields on receipts", () => {
    const strategy = { on_time: 1, total: 1, extra_cost_thb: 32, lines: [timedLine], needs_human: [] };
    const result = {
      affected: [{ order_id: "101", qty: 8, received_at: "2026-11-21T09:40:00+07:00", deadline_at: timedLine.deadline_at }],
      first_come: strategy, joint: strategy,
      solver: { mode: "branch_and_bound", optimality: "proven", nodes: 37, node_limit: 200000 },
      budget_thb: 100, plan_hash: planHash, state_version: "v1",
    };
    expect(planResponseSchema.parse(result)).toEqual(result);
    expect(planResponseSchema.safeParse({ ...result, joint: { ...strategy, lines: [line] } }).success).toBe(false);
    expect(reservationResponseSchema.parse({ receipt, replayed: true }).receipt.lines).toEqual([line]);
    expect(reservationResponseSchema.safeParse({ receipt: { ...receipt, lines: [timedLine] }, replayed: true }).success).toBe(false);
  });
});
