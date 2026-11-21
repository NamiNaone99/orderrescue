import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST as apply } from "@/app/api/chat/apply/route";
import { POST as interpret } from "@/app/api/interpret/route";
import { createPlan } from "@/lib/api/planning";
import { publicState } from "@/lib/api/state";
import { planChanges } from "@/lib/client/plan-changes";
import { heroFollowups } from "@/lib/domain/chat-samples";
import {
  chatApplyResponseSchema,
  interpretResponseSchema,
  type ChatApply,
  type WarehouseEvent,
} from "@/lib/domain/contracts";
import { heroIncident, heroTime } from "@/lib/scenarios/hero";
import { getStore } from "@/lib/store";

const { warehouse_id, sku_id, window_start, window_end } = heroIncident;
const incident = { warehouse_id, sku_id, window_start, window_end };
const store = getStore();
const snapshot = () => store.getSnapshot("hero", { sku: sku_id });
const planned = (budget_thb = 100) => createPlan({ scenario: "hero", incident, budget_thb });
const post = (body: unknown) =>
  new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
let testTime = Date.now();
beforeEach(async () => {
  testTime += 60_000;
  vi.spyOn(Date, "now").mockReturnValue(testTime);
  await store.reset("hero");
  vi.stubEnv("INTERPRETER_MODE", "offline");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function proposed(index: number): Promise<ChatApply> {
  const message = heroFollowups[index].text;
  const chat = { incident };
  const response = await interpret(post({ scenario: "hero", message, chat }));
  expect(response.status).toBe(200);
  const result = interpretResponseSchema.parse(await response.json());
  if (result.outcome !== "event") throw new Error("Expected a chat report");
  return {
    scenario: "hero",
    chat,
    message,
    event: result.event,
    evidence_quote: result.evidence_quote,
    key: crypto.randomUUID(),
  };
}
it.each([0, 1, 2])(
  "applies confirmed follow-up %i once, detects staleness and replans from the persisted result",
  async (index) => {
    const before = await snapshot(),
      plan = await planned(),
      proposal = await proposed(index);
    expect(await snapshot()).toEqual(before);
    const replies = await Promise.all(Array.from({ length: 5 }, () => apply(post(proposal))));
    const results = await Promise.all(
      replies.map(async (response) => {
        expect(response.status).toBe(200);
        return chatApplyResponseSchema.parse(await response.json());
      }),
    );
    expect(results.filter((v) => !v.replayed)).toHaveLength(1);
    const after = await snapshot();
    expect(after.state_version).not.toBe(before.state_version);
    expect(after.orders).toEqual(before.orders);
    expect(after.reservations).toEqual([]);
    const target = after.stock.find((r) => r.warehouse_id === proposal.event.warehouse_id);
    const orig = before.stock.find((r) => r.warehouse_id === proposal.event.warehouse_id);
    expect(target?.revision).toBe((orig?.revision ?? 0) + 1);
    expect(target?.report_revision).toBe(target?.revision);
    expect(target?.committed).toBe(orig?.committed);
    expect(planChanges(plan, publicState(before), publicState(after))).toEqual([
      expect.objectContaining({ warehouse: proposal.event.warehouse_id }),
    ]);
    const next = await planned();
    if (index === 0) {
      expect(target?.ready_at).toBe(heroTime("14:30"));
      expect(next.joint).toMatchObject({ on_time: 1, extra_cost_thb: 32 });
    }
    if (index === 1) {
      expect(target?.on_hand).toBe((orig?.on_hand ?? 0) + 4);
      expect(next.joint.on_time).toBe(2);
    }
    if (index === 2) {
      expect(next.effective_window_end).toBe(heroTime("13:30"));
      expect(next.joint).toMatchObject({ on_time: 2, extra_cost_thb: 0 });
      expect(
        next.joint.lines.every((line) => line.warehouse_id === "A" && line.ready_at === heroTime("13:30")),
      ).toBe(true);
      const different = await createPlan({
        scenario: "hero",
        incident: { ...incident, window_start: heroTime("12:59") },
        budget_thb: 100,
      });
      expect(different.effective_window_end).toBeUndefined();
    }
    expect((await planned()).plan_hash).toBe(next.plan_hash);
    expect(await snapshot()).toEqual(after);
    expect(planChanges(next, publicState(after), publicState(await snapshot()))).toEqual([]);
  },
);

it("invalidates an empty plan after stock is found and preserves a historical receipt's rows", async () => {
  const before = await snapshot(),
    none = await planned(0);
  expect(none.joint.lines).toEqual([]);
  const proposal = await proposed(1);
  await apply(post(proposal));
  expect(planChanges(none, publicState(before), publicState(await snapshot()))).toMatchObject([
    { warehouse: "C" },
  ]);
  const observedAfter = publicState(await snapshot());
  expect(planChanges(none, observedAfter, observedAfter)).toEqual([
    { kind: "report", warehouse: "C", sku: sku_id },
  ]);
  const plan = await planned();
  const booking = await store.reserve({
    scenario: "hero",
    incident,
    budget_thb: 100,
    idempotency_key: crypto.randomUUID(),
    plan_hash: plan.plan_hash,
    lines: plan.joint.lines.map(({ order_id, sku_id, warehouse_id, qty, unit_cost_thb, expected_revision }) => ({
      order_id,
      sku_id,
      warehouse_id,
      qty,
      unit_cost_thb,
      expected_revision,
    })),
  });
  const another = await proposed(1);
  await apply(post(another));
  expect((await snapshot()).reservations[0]).toMatchObject(booking.receipt);
});

it("rejects changed report keys, edited evidence, fabricated fields and a stale delay without partially applying", async () => {
  const proposal = await proposed(1);
  await apply(post(proposal));
  const after = await snapshot();
  const second = {
    ...proposal,
    message: "คลัง C พบ SKU-X เพิ่มอีก 6 หน่วย",
    evidence_quote: "คลัง C พบ SKU-X เพิ่มอีก 6 หน่วย",
    event: { ...proposal.event, quantity: 6 },
  };
  const conflict = await apply(post(second));
  expect(conflict.status).toBe(409);
  expect(await conflict.json()).toMatchObject({ error: { code: "IDEMPOTENCY_CONFLICT" } });
  for (const invalid of [
    { ...proposal, evidence_quote: "other" },
    { ...proposal, event: { ...proposal.event, warehouse_id: "B" } },
    { ...proposal, message: proposal.message + " หรือ 9 หน่วย" },
    { ...proposal, event: { ...proposal.event, cost: 1 } },
  ]) {
    expect((await apply(post(invalid))).status).toBe(422);
  }
  await expect(
    store.applyWarehouseReport("hero", crypto.randomUUID(), {
      type: "delay",
      warehouse_id: "B",
      sku_id,
      at: heroTime("13:10"),
    }),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  expect(await snapshot()).toEqual(after);
});

it("applies a real-day SKU report only in its own scenario and stock row", async () => {
  const before = await store.getSnapshot("real-day");
  const row = before.stock[0];
  const event: WarehouseEvent = {
    type: "stock_found",
    warehouse_id: row.warehouse_id,
    sku_id: row.sku_id,
    quantity: 2,
  };
  const key = crypto.randomUUID();
  try {
    expect(await store.applyWarehouseReport("real-day", key, event)).toEqual({ applied: true, replayed: false });
    expect(await store.applyWarehouseReport("real-day", key.toUpperCase(), event)).toEqual({
      applied: true,
      replayed: true,
    });
    const after = await store.getSnapshot("real-day", { sku: row.sku_id });
    expect(after.stock.find((r) => r.warehouse_id === row.warehouse_id)?.on_hand).toBe(row.on_hand + 2);
    expect((await snapshot()).stock.every((r) => r.revision === 1)).toBe(true);
  } finally {
    await store.reset("real-day");
  }
});

it.each([true, false])(
  "preserves a later chat readiness when the predefined simulator runs (chat first %s)",
  async (chatFirst) => {
    const event = { type: "delay" as const, warehouse_id: "B" as const, sku_id, at: heroTime("15:15") };
    const key = crypto.randomUUID();
    const report = () => store.applyWarehouseReport("hero", key, event);
    const preset = () => store.applyDemoEvent("hero", "b-slips-1430");
    await Promise.all(chatFirst ? [report(), preset()] : [preset(), report()]);
    const current = await snapshot();
    expect(current.stock.find((r) => r.warehouse_id === "B")).toMatchObject({
      ready_at: heroTime("15:15"),
      revision: chatFirst ? 2 : 3,
    });
    expect(current.scenario.demo_events[0].applied).toBe(true);
    await Promise.all([report(), preset()]);
    expect(await snapshot()).toEqual(current);
  },
);
