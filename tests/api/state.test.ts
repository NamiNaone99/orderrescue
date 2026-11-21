import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as health } from "@/app/api/health/route";
import { GET as state } from "@/app/api/state/route";
import { POST as demoEvent } from "@/app/api/demo/event/route";
import { POST as reset } from "@/app/api/demo/reset/route";
import {
  demoEventResponseSchema, errorResponseSchema, healthResponseSchema, stateResponseSchema,
} from "@/lib/domain/contracts";
import * as interpreter from "@/lib/interpreter/runtime";
import { heroSnapshot, heroTime } from "@/lib/scenarios/hero";
import * as stores from "@/lib/store";
import { StoreError } from "@/lib/store/types";

const origin = "http://localhost";
const eventId = "b-slips-1430";

async function readState(query = "scenario=hero") {
  const response = await state(new Request(`${origin}/api/state?${query}`));
  expect(response.status).toBe(200);
  return stateResponseSchema.parse(await response.json());
}

function applyEvent(body: unknown) {
  return demoEvent(new Request(`${origin}/api/demo/event`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
}

beforeEach(async () => {
  vi.stubEnv("STORAGE_MODE", "memory");
  vi.stubEnv("INTERPRETER_MODE", "offline");
  await stores.getStore().reset("hero");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("GET /api/health", () => {
  it("reports active modes, model, degradation and the development commit", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", undefined);
    const response = await health(new Request(`${origin}/api/health`));
    expect(response.status).toBe(200);
    expect(healthResponseSchema.parse(await response.json())).toEqual({
      ok: true, storage: "memory", interpreter: "offline", model: null, degraded: false, commit: "dev",
    });
  });

  it("shows the memory fallback badge when the configured database health read fails", async () => {
    const memory = stores.getStore();
    vi.spyOn(stores, "getStore").mockReturnValue(memory);
    vi.spyOn(memory, "health").mockRejectedValue(new StoreError("STORAGE_UNAVAILABLE", "Health read failed"));
    vi.stubEnv("STORAGE_MODE", "supabase");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "3c8ee19");
    const response = await health(new Request(`${origin}/api/health`));
    expect(response.status).toBe(200);
    expect(healthResponseSchema.parse(await response.json())).toMatchObject({
      storage: "memory", degraded: true, commit: "3c8ee19",
    });
  });

  it("reports degraded health and keeps fallback reads available while refusing demo writes", async () => {
    await stores.getStore().applyDemoEvent("hero", eventId);
    const before = await readState();
    vi.stubEnv("SUPABASE_URL", undefined);
    vi.stubEnv("SUPABASE_SECRET_KEY", undefined);
    vi.stubEnv("STORAGE_MODE", "supabase");
    const response = await health(new Request(`${origin}/api/health`));
    expect(response.status).toBe(200);
    expect(healthResponseSchema.parse(await response.json())).toMatchObject({ storage: "memory", degraded: true });
    const event = await applyEvent({ scenario: "hero", event_id: eventId });
    const resetResponse = await reset(new Request(`${origin}/api/demo/reset`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenario: "hero" }),
    }));
    for (const write of [event, resetResponse]) {
      expect(write.status).toBe(503);
      expect(errorResponseSchema.parse(await write.json()).error.code).toBe("STORAGE_UNAVAILABLE");
    }
    expect(await readState()).toEqual(before);
  });

  it("reports the primary model when the active interpreter has a provider", async () => {
    vi.spyOn(interpreter, "getInterpreterMode").mockReturnValue({ interpreter: "openai", model: "gpt-6-luna" });
    const response = await health(new Request(`${origin}/api/health`));
    expect(response.status).toBe(200);
    expect(healthResponseSchema.parse(await response.json())).toMatchObject({ interpreter: "openai", model: "gpt-6-luna" });
  });
});

describe("GET /api/state", () => {
  it("projects the scenario, public sample text, free stock and nested order lines", async () => {
    const result = await readState();
    expect(result.scenario).toMatchObject({
      shifts: heroSnapshot.scenario.shifts, default_sku_id: "SKU-X",
      name_th: "ตัวอย่างเตรียมของไม่ทันรอบส่ง",
      sample_messages: [
        { text: "คลัง A เตรียม SKU-X ให้ทันรอบบ่ายวันนี้ไม่ได้ครับ", label_th: "เตรียมของไม่ทันรอบบ่าย" },
        { text: "ของตัวนี้เตรียมไม่ทันรอบบ่ายครับ", label_th: "ข้อมูลไม่ครบ" },
        { text: "พรุ่งนี้ใครเข้ากะเช้าบ้าง", label_th: "ถามเรื่องกะงาน" },
      ],
    });
    expect(result.stock.find(row => row.warehouse_id === "B")).toMatchObject({ on_hand: 20, committed: 12, free: 8 });
    expect(result.orders.find(order => order.id === "101")).toEqual({
      id: "101", received_at: heroTime("09:40"), deadline_at: heroTime("14:00"), status: "open",
      home_warehouse_id: "A", lines: [{ sku_id: "SKU-X", qty: 8 }],
    });
    expect(result.reservations).toEqual([]);
  });

  it("filters to open SKUs by default and retains the full state version and public receipt summary", async () => {
    const { receipt } = await stores.getStore().reserve({
      scenario: "hero", incident: { warehouse_id: "A", sku_id: "SKU-X", window_start: heroTime("13:00"), window_end: heroTime("18:00") },
      budget_thb: 100, idempotency_key: "00000000-0000-4000-8000-000000000001",
      plan_hash: "b01136be688e152fa1989058fa6070cb8de7dac5162e820eee17ec2dcaad41e7",
      lines: [
        { order_id: "101", warehouse_id: "B", sku_id: "SKU-X", qty: 8, unit_cost_thb: 4, expected_revision: 1 },
        { order_id: "102", warehouse_id: "C", sku_id: "SKU-X", qty: 8, unit_cost_thb: 7, expected_revision: 1 },
      ],
    });
    const open = await readState();
    expect(open).toMatchObject({ skus: [], stock: [], orders: [] });
    expect(open.reservations).toEqual([{
      id: receipt.id, created_at: receipt.created_at, total_extra_cost_thb: 88, lines: receipt.lines,
    }]);
    const selected = await readState("scenario=hero&sku=SKU-X");
    expect(selected.skus.map(sku => sku.id)).toEqual(["SKU-X"]);
    expect(selected.stock).toHaveLength(3);
    expect(selected.orders.map(order => order.status)).toEqual(["reserved", "reserved"]);
    expect(selected.state_version).toBe(open.state_version);
  });

  it.each(["scenario=hero-test", "scenario=hero&extra=x", "scenario=hero&sku=absent"])(
    "rejects a private scenario, unknown parameter or unknown SKU (%s)", async query => {
      const response = await state(new Request(`${origin}/api/state?${query}`));
      expect(response.status).toBe(422);
      const { error } = errorResponseSchema.parse(await response.json());
      expect(error).toMatchObject({ code: "INVALID_INPUT", request_id: response.headers.get("x-request-id") });
    },
  );
});

describe("POST /api/demo/event", () => {
  it("applies the predefined slip and returns the version visible to the next state read", async () => {
    const previous = await readState();
    const response = await applyEvent({ scenario: "hero", event_id: eventId });
    expect(response.status).toBe(200);
    const applied = demoEventResponseSchema.parse(await response.json());
    expect(applied.applied).toBe(true);
    expect(applied.state_version).not.toBe(previous.state_version);
    const current = await readState();
    expect(current.state_version).toBe(applied.state_version);
    expect(current.scenario.demo_events.find(event => event.id === eventId)?.applied).toBe(true);
    expect(current.stock.find(row => row.warehouse_id === "B")?.ready_at).toBe(heroTime("14:30"));
  });

  it("rejects free-form stock mutations", async () => {
    const previous = await readState();
    const response = await applyEvent({ scenario: "hero", event_id: eventId, ready_at: heroTime("18:00") });
    expect(response.status).toBe(422);
    expect(errorResponseSchema.parse(await response.json()).error.code).toBe("INVALID_INPUT");
    expect(await readState()).toEqual(previous);
  });
});
