import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReservationRequest } from "@/lib/domain/contracts";
import { heroIncident } from "@/lib/scenarios/hero";
import { getStore } from "@/lib/store";
import { stateVersion } from "@/lib/store/types";

function heroBooking(): ReservationRequest {
  const { warehouse_id, sku_id, window_start, window_end } = heroIncident;
  return {
    scenario: "hero",
    incident: { warehouse_id, sku_id, window_start, window_end },
    budget_thb: 100,
    idempotency_key: "00000000-0000-4000-8000-000000000001",
    plan_hash: "b01136be688e152fa1989058fa6070cb8de7dac5162e820eee17ec2dcaad41e7",
    lines: [
      { order_id: "101", sku_id, warehouse_id: "B", qty: 8, unit_cost_thb: 4, expected_revision: 1 },
      { order_id: "102", sku_id, warehouse_id: "C", qty: 8, unit_cost_thb: 7, expected_revision: 1 },
    ],
  };
}

describe("memory store integration", () => {
  beforeEach(async () => {
    vi.stubEnv("STORAGE_MODE", "memory");
    await getStore().reset("hero");
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([undefined, "memory", "unrecognised"])("selects memory for STORAGE_MODE=%s", async (mode) => {
    vi.stubEnv("STORAGE_MODE", mode);
    expect(await getStore().health()).toEqual({ storage: "memory", degraded: false });
  });

  it("preserves a changed scenario when the store modules reload", async () => {
    const store = getStore();
    const before = await store.getSnapshot("hero");
    await store.applyDemoEvent("hero", "b-slips-1430");
    const changed = await store.getSnapshot("hero");
    expect(changed.state_version).not.toBe(before.state_version);

    vi.resetModules();
    const reloaded = await import("@/lib/store");
    expect(await reloaded.getStore().getSnapshot("hero")).toEqual(changed);
  });

  it("isolates mutable snapshots, submitted lines and returned receipts from storage", async () => {
    const store = getStore();
    const original = await store.getSnapshot("hero");
    const edited = await store.getSnapshot("hero");
    edited.stock[0].committed = edited.stock[0].on_hand;
    edited.scenario.sample_messages.length = 0;
    expect(await store.getSnapshot("hero")).toEqual(original);

    const request = heroBooking();
    const retry = structuredClone(request);
    const { receipt } = await store.reserve(request);
    const expectedReceipt = structuredClone(receipt);
    request.lines[0].qty = 1;
    receipt.lines[1].unit_cost_thb = 0;
    expect((await store.getSnapshot("hero")).reservations[0].lines).toEqual(expectedReceipt.lines);
    const replay = await store.reserve(retry);
    expect(replay.receipt).toEqual(expectedReceipt);
    replay.receipt.lines.length = 0;
    expect((await store.reserve(retry)).receipt).toEqual(expectedReceipt);
  });

  it("versions stock revisions and order statuses regardless of array order", async () => {
    const snapshot = await getStore().getSnapshot("hero");
    const shuffled = { stock: [...snapshot.stock].reverse(), orders: [...snapshot.orders].reverse() };
    expect(stateVersion(shuffled)).toBe(snapshot.state_version);
    const stock = structuredClone(shuffled.stock);
    stock[0].revision++;
    expect(stateVersion({ ...shuffled, stock })).not.toBe(snapshot.state_version);
    const orders = structuredClone(shuffled.orders);
    orders[0].status = "reserved";
    expect(stateVersion({ ...shuffled, orders })).not.toBe(snapshot.state_version);
  });

  it("uses the whole scenario version for both SKU and open-SKU reads", async () => {
    const store = getStore();
    await store.reserve(heroBooking());
    const full = await store.getSnapshot("hero");
    const filtered = await store.getSnapshot("hero", { openSkusOnly: true });
    expect(full.stock).toHaveLength(3);
    expect(filtered).toMatchObject({ skus: [], stock: [], orders: [], state_version: full.state_version });
    const oneSku = await store.getSnapshot("hero", { sku: "SKU-X" });
    expect(oneSku.state_version).toBe(full.state_version);
  });

  it("rejects an unknown demo event without changing the scenario", async () => {
    const store = getStore();
    const before = await store.getSnapshot("hero");
    await expect(store.applyDemoEvent("hero", "unknown-event")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(await store.getSnapshot("hero")).toEqual(before);
  });

  it("distinguishes an unknown SKU filter from a known SKU with no open orders", async () => {
    const store = getStore();
    await store.reserve(heroBooking());
    const before = await store.getSnapshot("hero");
    await expect(store.getSnapshot("hero", { sku: "23084" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect((await store.getSnapshot("hero", { sku: "SKU-X" })).skus).toEqual(before.skus);
    expect(await store.getSnapshot("hero")).toEqual(before);
  });
});
