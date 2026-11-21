import { randomBytes, randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { reservationResponseSchema, type ReservationRequest, type ReservationResponse, type WarehouseEvent } from "@/lib/domain/contracts";
import type { ErrorCode, Warehouse } from "@/lib/domain/types";
import type { Store, StoreReservationRequest, StoreSnapshot } from "@/lib/store/types";

type Line = ReservationRequest["lines"][number];
type Context<Id extends string> = { store: Store<Id>; scenarioId: Id };

function line(orderId: string, warehouseId: Warehouse["id"]): Line {
  const unitCost = { A: 0, B: 4, C: 7 }[warehouseId];
  return {
    order_id: orderId, sku_id: "SKU-X", warehouse_id: warehouseId,
    qty: 8, unit_cost_thb: unitCost, expected_revision: 1,
  };
}

export function storeContract<Id extends string>(make: () => Context<Id> | Promise<Context<Id>>) {
  describe("store contract", { concurrent: false, timeout: 30_000 }, () => {
    let store: Store<Id>;
    let scenarioId: Id;
    let seed: StoreSnapshot<Id>;

    beforeEach(async () => {
      ({ store, scenarioId } = await make());
      await store.reset(scenarioId);
      seed = structuredClone(await store.getSnapshot(scenarioId));
    }, 30_000);

    function booking(lines: Line[], budget = 100): StoreReservationRequest<Id> {
      return {
        scenario: scenarioId, idempotency_key: randomUUID(),
        // Hash verification belongs to the route. The store tests equality of this opaque value.
        plan_hash: randomBytes(32).toString("hex"), budget_thb: budget, lines,
        incident: {
          warehouse_id: "A", sku_id: "SKU-X",
          window_start: "2026-11-21T13:00:00+07:00", window_end: "2026-11-21T18:00:00+07:00",
        },
      };
    }

    async function expectRefusal(request: StoreReservationRequest<Id>, code: ErrorCode) {
      const before = structuredClone(await store.getSnapshot(scenarioId));
      await expect(store.reserve(request)).rejects.toMatchObject({ code });
      expect(await store.getSnapshot(scenarioId)).toEqual(before);
    }

    async function expectBooking(
      request: StoreReservationRequest<Id>, result: ReservationResponse,
      increments: Partial<Record<Warehouse["id"], number>>, totalCost: number,
    ) {
      reservationResponseSchema.parse(result);
      expect(result).toMatchObject({
        replayed: false,
        receipt: {
          idempotency_key: request.idempotency_key, plan_hash: request.plan_hash,
          total_extra_cost_thb: totalCost, lines: request.lines,
        },
      });
      const after = await store.getSnapshot(scenarioId);
      expect(after.state_version).not.toBe(seed.state_version);
      const reservedOrders = request.lines.map(item => item.order_id);
      expect(after).toEqual({
        ...seed,
        stock: seed.stock.map(row => {
          const qty = row.sku_id === "SKU-X" && increments[row.warehouse_id];
          return qty ? { ...row, committed: row.committed + qty, revision: row.revision + 1 } : row;
        }),
        orders: seed.orders.map(order =>
          reservedOrders.includes(order.id) ? { ...order, status: "reserved" } : order,
        ),
        reservations: [{ ...result.receipt, budget_thb: request.budget_thb }],
        state_version: after.state_version,
      });
      return structuredClone(after);
    }

    it("books the submitted rows and quantities exactly", async () => {
      const request = booking([line("101", "B"), line("102", "C")]);
      await expectBooking(request, await store.reserve(request), { B: 8, C: 8 }, 88);
    });

    it("rolls back a two-row booking when one revision is stale", async () => {
      const request = booking([line("101", "B"), line("102", "C")]);
      request.lines[1].expected_revision++;
      await expectRefusal(request, "STALE_STOCK");
    });

    it("rejects insufficient aggregate stock", async () => {
      await expectRefusal(booking([line("101", "B"), line("102", "B")]), "STALE_STOCK");
    });

    it("rejects a changed unit cost", async () => {
      const request = booking([line("101", "B"), line("102", "C")]);
      request.lines[1].unit_cost_thb = 4;
      await expectRefusal(request, "STALE_STOCK");
    });

    it("replays the original receipt for the same key and hash", async () => {
      const request = booking([line("101", "B")]);
      request.idempotency_key = "a2cec510-37b1-4492-845c-ad281a1c3d16";
      const first = await store.reserve(request);
      const saved = await expectBooking(request, first, { B: 8 }, 32);
      expect(await store.reserve(request)).toEqual({ receipt: first.receipt, replayed: true });
      const upperCaseKey = { ...request, idempotency_key: request.idempotency_key.toUpperCase() };
      expect(await store.reserve(upperCaseKey)).toEqual({ receipt: first.receipt, replayed: true });
      expect(await store.getSnapshot(scenarioId)).toEqual(saved);
    });

    it("refuses a different hash for an existing key", async () => {
      const first = booking([line("101", "B")]);
      await store.reserve(first);
      const changed = booking([line("102", "C")]);
      changed.idempotency_key = first.idempotency_key;
      await expectRefusal(changed, "IDEMPOTENCY_CONFLICT");
    });

    it("refuses an already reserved order", async () => {
      await store.reserve(booking([line("101", "B")]));
      await expectRefusal(booking([line("101", "C")]), "ORDER_ALREADY_RESERVED");
    });

    it("refuses a quantity different from the ordered quantity", async () => {
      const request = booking([line("101", "B"), line("102", "C")]);
      request.lines[1].qty = 4;
      await expectRefusal(request, "INVALID_INPUT");
    });

    it("refuses an unknown order", async () => {
      await expectRefusal(booking([line("101", "B"), line("103", "C")]), "INVALID_INPUT");
    });

    it("refuses a SKU absent from the order", async () => {
      const request = booking([line("101", "B")]);
      request.lines[0].sku_id = "23084";
      await expectRefusal(request, "INVALID_INPUT");
    });

    it("refuses an unknown incident SKU without changing stock", async () => {
      const request = booking([line("101", "B")]);
      request.incident.sku_id = "23084";
      await expectRefusal(request, "INVALID_INPUT");
    });

    it("rejects an over-budget booking", async () => {
      await expectRefusal(booking([line("101", "B"), line("102", "C")], 87), "OVER_BUDGET");
    });

    it("sums two lines on one stock row and increments its revision once", async () => {
      const request = booking([line("101", "A"), line("102", "A")]);
      await expectBooking(request, await store.reserve(request), { A: 16 }, 0);
    });

    it("refuses inconsistent expected revisions on one stock row", async () => {
      const request = booking([line("101", "A"), line("102", "A")]);
      request.lines[1].expected_revision++;
      await expectRefusal(request, "INVALID_INPUT");
    });

    it("rolls back duplicate lines for the same order and SKU", async () => {
      await expectRefusal(booking([line("101", "B"), line("101", "C")]), "ORDER_ALREADY_RESERVED");
    });

    // The shared suite also runs against a remote database, where each round makes several requests.
    const raceTimeout = 10 * 60_000;

    it("allows one winner for eight contested units in each of 50 races", { timeout: raceTimeout }, async () => {
      for (let round = 0; round < 50; round++) {
        if (round > 0) await store.reset(scenarioId);
        const requests = [booking([line("101", "B")]), booking([line("102", "B")])];
        const results = await Promise.all(requests.map(request => store.reserve(request).then(
          value => ({ success: true as const, request, value }),
          (error: unknown) => ({ success: false as const, error }),
        )));
        const winners = results.filter(result => result.success);
        const failures = results.filter(result => !result.success);
        expect(winners).toHaveLength(1);
        expect(failures).toMatchObject([{ error: { code: "STALE_STOCK" } }]);
        const winner = winners[0];
        const after = await expectBooking(winner.request, winner.value, { B: 8 }, 32);
        for (const row of after.stock) expect(row.committed).toBeLessThanOrEqual(row.on_hand);
      }
    });

    it("replays four of five concurrent confirmations in each of 50 races", { timeout: raceTimeout }, async () => {
      for (let round = 0; round < 50; round++) {
        if (round > 0) await store.reset(scenarioId);
        const request = booking([line("101", "B")]);
        const results = await Promise.all(Array.from({ length: 5 }, () => store.reserve(request)));
        const created = results.filter(result => !result.replayed);
        expect(created).toHaveLength(1);
        expect(results.filter(result => result.replayed)).toHaveLength(4);
        for (const result of results) expect(result.receipt).toEqual(created[0].receipt);
        await expectBooking(request, created[0], { B: 8 }, 32);
      }
    });

    it("applies the ready-time event and revision change only once", async () => {
      const eventId = "b-slips-1430";
      const first = await store.applyDemoEvent(scenarioId, eventId);
      const after = structuredClone(await store.getSnapshot(scenarioId));
      expect(first).toEqual({ applied: true, state_version: after.state_version });
      expect(after.state_version).not.toBe(seed.state_version);
      expect(after).toEqual({
        ...seed,
        scenario: {
          ...seed.scenario,
          demo_events: seed.scenario.demo_events.map(event =>
            event.id === eventId ? { ...event, applied: true } : event,
          ),
        },
        stock: seed.stock.map(row => row.warehouse_id === "B" && row.sku_id === "SKU-X"
          ? { ...row, revision: row.revision + 1, ready_at: "2026-11-21T14:30:00+07:00" }
          : row),
        state_version: after.state_version,
      });
      await store.applyDemoEvent(scenarioId, eventId);
      expect(await store.getSnapshot(scenarioId)).toEqual(after);
    });

    it("restores the seed after booking and a demo event", async () => {
      await store.reserve(booking([line("101", "B")]));
      await store.applyDemoEvent(scenarioId, "b-slips-1430");
      await store.reset(scenarioId);
      expect(await store.getSnapshot(scenarioId)).toEqual(seed);
    });

    it("adds reported stock once across five requests and refuses a conflicting key", async () => {
      const key = randomUUID();
      const event: WarehouseEvent = { type: "stock_found", warehouse_id: "C", sku_id: "SKU-X", quantity: 4 };
      const results = await Promise.all(Array.from({ length: 5 }, () => store.applyWarehouseReport(scenarioId, key, event)));
      expect(results.filter(result => !result.replayed)).toHaveLength(1);
      const after = await store.getSnapshot(scenarioId);
      expect(after.stock.find(row => row.warehouse_id === "C")).toMatchObject({ on_hand: 12, committed: 0, revision: 2, report_revision: 2 });
      expect(await store.applyWarehouseReport(scenarioId, key.toUpperCase(), event)).toEqual({ applied: true, replayed: true });
      await expect(store.applyWarehouseReport(scenarioId, key, { ...event, quantity: 5 })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
      expect(await store.getSnapshot(scenarioId)).toEqual(after);
    });

    it("keeps a later reported departure when the preset and report run together", async () => {
      const event: WarehouseEvent = { type: "delay", warehouse_id: "B", sku_id: "SKU-X", at: "2026-11-21T15:15:00+07:00" };
      const key = randomUUID();
      await Promise.all([store.applyWarehouseReport(scenarioId, key, event), store.applyDemoEvent(scenarioId, "b-slips-1430")]);
      const after = await store.getSnapshot(scenarioId);
      expect(after.stock.find(row => row.warehouse_id === "B")).toMatchObject({ ready_at: event.at });
      expect(after.scenario.demo_events.find(preset => preset.id === "b-slips-1430")?.applied).toBe(true);
      await store.applyWarehouseReport(scenarioId, key, event);
      await store.applyDemoEvent(scenarioId, "b-slips-1430");
      expect(await store.getSnapshot(scenarioId)).toEqual(after);
    });

    it("records the exact resumed outage, refuses out-of-window time and restores the seed on reset", async () => {
      const event: WarehouseEvent = { type: "resumed", warehouse_id: "A", sku_id: "SKU-X", at: "2026-11-21T13:30:00+07:00",
        window_start: "2026-11-21T13:00:00+07:00", window_end: "2026-11-21T18:00:00+07:00" };
      await store.applyWarehouseReport(scenarioId, randomUUID(), event);
      const after = await store.getSnapshot(scenarioId);
      expect(after.resumptions).toEqual([event]);
      expect(after.stock.find(row => row.warehouse_id === "A")).toMatchObject({ on_hand: 24, committed: 8, revision: 2, report_revision: 2 });
      await expect(store.applyWarehouseReport(scenarioId, randomUUID(), { ...event, at: event.window_end })).rejects.toMatchObject({ code: "INVALID_INPUT" });
      expect(await store.getSnapshot(scenarioId)).toEqual(after);
      await store.reset(scenarioId);
      expect(await store.getSnapshot(scenarioId)).toEqual(seed);
    });
  });
}
