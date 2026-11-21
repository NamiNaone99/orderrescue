import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { heroIncident, heroSnapshot } from "@/lib/scenarios/hero";
import { SupabaseStore } from "@/lib/store/supabase";
import { getStore } from "@/lib/store";
import { stateVersion, StoreError, type StoreReservationRequest } from "@/lib/store/types";

const request: StoreReservationRequest = {
  scenario: "hero",
  incident: { warehouse_id: "A", sku_id: "SKU-X", window_start: heroIncident.window_start, window_end: heroIncident.window_end },
  budget_thb: 100, idempotency_key: randomUUID(), plan_hash: "0".repeat(64),
  lines: [{ order_id: "101", sku_id: "SKU-X", warehouse_id: "B", qty: 8, unit_cost_thb: 4, expected_revision: 1 }],
};

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://storage.invalid");
  vi.stubEnv("SUPABASE_SECRET_KEY", "local-test-value");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("books with one RPC carrying exactly the confirmed lines and returns a Bangkok receipt", async () => {
  const receipt = {
    id: randomUUID(), idempotency_key: request.idempotency_key, plan_hash: request.plan_hash,
    lines: request.lines, created_at: "2026-11-21T05:30:00+00:00", total_extra_cost_thb: 32,
  };
  const fetch = vi.fn<(url: string, options: RequestInit) => Promise<Response>>()
    .mockResolvedValue(Response.json({ receipt, replayed: false }));
  vi.stubGlobal("fetch", fetch);
  const store = new SupabaseStore();
  expect(await store.reserve(request)).toEqual({ replayed: false, receipt: { ...receipt, created_at: heroSnapshot.scenario.now_at } });
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, options] = fetch.mock.calls[0];
  expect(String(url)).toBe("https://storage.invalid/rest/v1/rpc/reserve_plan");
  expect(options.method).toBe("POST");
  const incident = new Headers(options.headers).get("x-orderrescue-incident");
  expect(Buffer.from(incident ?? "", "base64").toString()).toBe(JSON.stringify(["A", "SKU-X"]));
  expect(JSON.parse(String(options.body))).toEqual({
    p_scenario: "hero", p_key: request.idempotency_key, p_budget: 100, p_plan_hash: request.plan_hash, p_lines: request.lines,
  });
});

it("maps SQL domain errors and suppresses unrecognized diagnostics", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ code: "P0001", message: "STALE_STOCK" }, { status: 400 }))
    .mockResolvedValueOnce(Response.json({ code: "22003", message: "out of range" }, { status: 400 }))
    .mockResolvedValueOnce(Response.json({ code: "42501", message: "private diagnostic" }, { status: 403 }));
  vi.stubGlobal("fetch", fetch);
  const store = new SupabaseStore();
  await expect(store.reserve(request)).rejects.toMatchObject({ code: "STALE_STOCK" });
  await expect(store.reserve(request)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  await expect(store.reserve(request)).rejects.toMatchObject({ code: "STORAGE_UNAVAILABLE", message: "Supabase storage is unavailable" });
});

it("rejects non-HTTPS configuration before issuing a request", async () => {
  vi.stubEnv("SUPABASE_URL", "http://storage.invalid");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(new SupabaseStore().health()).rejects.toMatchObject({ code: "STORAGE_UNAVAILABLE" });
  expect(fetch).not.toHaveBeenCalled();
});

it("refuses writes after a fallback read until that scenario can be refreshed from Supabase", async () => {
  vi.stubEnv("STORAGE_MODE", "supabase");
  const live = { ...heroSnapshot, state_version: stateVersion(heroSnapshot) };
  const read = vi.spyOn(SupabaseStore.prototype, "getSnapshot")
    .mockRejectedValueOnce(new StoreError("STORAGE_UNAVAILABLE", "Unavailable")).mockResolvedValue(live);
  const book = vi.spyOn(SupabaseStore.prototype, "reserve")
    .mockRejectedValue(new StoreError("STALE_STOCK", "Changed stock"));
  vi.spyOn(SupabaseStore.prototype, "health").mockResolvedValue({ storage: "supabase", degraded: false });
  const store = getStore();
  expect(await store.getSnapshot("hero")).toEqual(live);
  expect(await store.health()).toEqual({ storage: "memory", degraded: true });
  await expect(store.reserve(request)).rejects.toMatchObject({ code: "STORAGE_UNAVAILABLE" });
  expect(book).not.toHaveBeenCalled();
  expect(await store.getSnapshot("hero")).toEqual(live);
  expect(read).toHaveBeenCalledTimes(2);
  expect(await store.health()).toEqual({ storage: "supabase", degraded: false });
  await expect(store.reserve(request)).rejects.toMatchObject({ code: "STALE_STOCK" });
  expect(book).toHaveBeenCalledOnce();
});
