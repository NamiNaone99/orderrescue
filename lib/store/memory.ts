import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  reservationRequestSchema, warehouseEventSchema, type DemoEventResponse, type ReservationRequest, type ReservationResponse, type WarehouseEvent,
} from "@/lib/domain/contracts";
import type { Reservation, ScenarioId, Snapshot } from "@/lib/domain/types";
import { scenarioRegistry } from "@/lib/scenarios";
import { filterSnapshot, stateVersion, StoreError, type SnapshotOptions, type Store, type StoreSnapshot } from "./types";

const seeds = new Map(Object.values(scenarioRegistry).map(seed => [seed.snapshot.scenario.id, seed]));
const runtime = globalThis as typeof globalThis & {
  orderRescueMemorySnapshots?: Map<ScenarioId, Snapshot>;
  orderRescueReports?: Map<ScenarioId, Map<string, WarehouseEvent>>;
};
const reports = runtime.orderRescueReports ??= new Map<ScenarioId, Map<string, WarehouseEvent>>();
const snapshots = runtime.orderRescueMemorySnapshots ??= new Map<ScenarioId, Snapshot>();
for (const [id, seed] of seeds) {
  if (!snapshots.has(id)) snapshots.set(id, structuredClone(seed.snapshot));
}

function snapshotFor(id: ScenarioId): Snapshot {
  const snapshot = snapshots.get(id);
  if (!snapshot) throw new StoreError("INVALID_INPUT", "Unknown scenario");
  return snapshot;
}

function requireSku(snapshot: Snapshot, skuId: string): void {
  if (!snapshot.skus.some(sku => sku.id === skuId)) {
    throw new StoreError("INVALID_INPUT", "Unknown SKU in this scenario");
  }
}

function receiptFor(reservation: Reservation): ReservationResponse["receipt"] {
  const { id, created_at, idempotency_key, plan_hash, total_extra_cost_thb, lines } = reservation;
  return { id, created_at, idempotency_key, plan_hash, total_extra_cost_thb, lines: structuredClone(lines) };
}

function rowKey(warehouse: string, sku: string): string {
  // Warehouse IDs are the single letters A, B and C.
  return `${warehouse}:${sku}`;
}

function orderLineKey(order: string, sku: string): string {
  return JSON.stringify([order, sku]);
}

function book(snapshot: Snapshot, request: ReservationRequest): Reservation {
  const { lines, budget_thb, plan_hash, idempotency_key } = request;
  const cost = lines.reduce((sum, line) => sum + line.qty * line.unit_cost_thb, 0);
  if (cost > budget_thb) throw new StoreError("OVER_BUDGET", "Confirmed lines exceed the booking budget");

  requireSku(snapshot, request.incident.sku_id);
  if (!snapshot.warehouses.some(warehouse => warehouse.id === request.incident.warehouse_id)) {
    throw new StoreError("INVALID_INPUT", "Unknown incident warehouse in this scenario");
  }

  const orders = new Map(snapshot.orders.map(order => [order.id, order]));
  const quantities = new Map(snapshot.order_lines.map(line => [orderLineKey(line.order_id, line.sku_id), line.qty]));
  const bookedOrders = new Set<string>();
  const bookedLines = new Set<string>();
  const rowGroups = new Map<string, ReservationRequest["lines"]>();
  for (const line of lines) {
    const order = orders.get(line.order_id);
    if (order?.status === "reserved") throw new StoreError("ORDER_ALREADY_RESERVED", "Order is already reserved");
    const orderKey = orderLineKey(line.order_id, line.sku_id);
    if (order?.status !== "open" || quantities.get(orderKey) !== line.qty) {
      throw new StoreError("INVALID_INPUT", "The confirmed line must match an open order line and quantity");
    }
    bookedOrders.add(line.order_id);
    bookedLines.add(orderKey);
    const key = rowKey(line.warehouse_id, line.sku_id);
    const group = rowGroups.get(key);
    if (group) group.push(line);
    else rowGroups.set(key, [line]);
  }

  const stock = new Map(snapshot.stock.map(row => [rowKey(row.warehouse_id, row.sku_id), row]));
  const sortedGroups = [...rowGroups].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  for (const [key, group] of sortedGroups) {
    const { expected_revision } = group[0];
    if (group.some(line => line.expected_revision !== expected_revision)) {
      throw new StoreError("INVALID_INPUT", "Confirmed lines disagree on the revision of a shared row");
    }
    const row = stock.get(key);
    const requestedQty = group.reduce((sum, line) => sum + line.qty, 0);
    if (!row || row.revision !== expected_revision || row.on_hand - row.committed < requestedQty) {
      throw new StoreError("STALE_STOCK", "Stock row, revision or available quantity changed");
    }
    for (const line of group) {
      const home = orders.get(line.order_id)?.home_warehouse_id;
      const unitCost = row.warehouse_id === home ? 0 : row.extra_cost_per_unit_thb;
      if (line.unit_cost_thb !== unitCost) throw new StoreError("STALE_STOCK", "Stock unit cost changed");
    }
    stock.set(key, { ...row, committed: row.committed + requestedQty, revision: row.revision + 1 });
  }
  if (bookedLines.size !== lines.length) {
    throw new StoreError("ORDER_ALREADY_RESERVED", "An order and SKU can be reserved only once");
  }

  const bangkokWallTime = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const reservation: Reservation = {
    id: randomUUID(), created_at: bangkokWallTime.toISOString().replace("Z", "+07:00"),
    idempotency_key, plan_hash, budget_thb, total_extra_cost_thb: cost, lines,
  };
  // Publish one replacement after all validations. The old snapshot remains intact on failure.
  snapshots.set(request.scenario, {
    ...snapshot,
    stock: [...stock.values()],
    orders: snapshot.orders.map(order => bookedOrders.has(order.id) ? { ...order, status: "reserved" } : order),
    reservations: [...snapshot.reservations, reservation],
  });
  return reservation;
}

export class MemoryStore implements Store {
  async getSnapshot(scenarioId: ScenarioId, opts: SnapshotOptions = {}): Promise<StoreSnapshot> {
    return filterSnapshot(structuredClone(snapshotFor(scenarioId)), opts);
  }

  async reserve(input: ReservationRequest): Promise<ReservationResponse> {
    const parsed = reservationRequestSchema.safeParse(input);
    if (!parsed.success) throw new StoreError("INVALID_INPUT", "Invalid reservation request");
    const request = parsed.data;
    request.idempotency_key = request.idempotency_key.toLowerCase();
    const snapshot = snapshotFor(request.scenario);
    for (const scenario of snapshots.values()) {
      const previous = scenario.reservations.find(r => r.idempotency_key.toLowerCase() === request.idempotency_key);
      if (previous) {
        if (previous.plan_hash !== request.plan_hash) {
          throw new StoreError("IDEMPOTENCY_CONFLICT", "This key was used for a different plan");
        }
        return { receipt: receiptFor(previous), replayed: true };
      }
    }
    return { receipt: receiptFor(book(snapshot, request)), replayed: false };
  }

  async applyDemoEvent(scenarioId: ScenarioId, eventId: string): Promise<DemoEventResponse> {
    const snapshot = snapshotFor(scenarioId);
    const event = snapshot.scenario.demo_events.find(event => event.id === eventId);
    const seed = seeds.get(scenarioId);
    const change = seed && Object.entries(seed.eventChanges).find(([id]) => id === eventId)?.[1];
    if (!event || !change) throw new StoreError("INVALID_INPUT", "Unknown demo event");
    if (!event.applied) {
      const row = snapshot.stock.find(row => row.warehouse_id === change.warehouse_id && row.sku_id === change.sku_id);
      if (!row) throw new StoreError("STALE_STOCK", "Missing stock row for demo event");
      row.ready_at = change.ready_at;
      row.revision += change.revision_increment;
      event.applied = true;
    }
    return { applied: true, state_version: stateVersion(snapshot) };
  }

  async applyWarehouseReport(scenarioId: ScenarioId, key: string, input: WarehouseEvent) {
    const parsed = warehouseEventSchema.safeParse(input);
    if (!z.uuid().safeParse(key).success || !parsed.success) throw new StoreError("INVALID_INPUT", "Invalid report");
    const event = parsed.data;
    const snapshot = snapshotFor(scenarioId);
    const prior = reports.get(scenarioId) ?? new Map<string, WarehouseEvent>();
    const previous = prior.get(key.toLowerCase());
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(event)) throw new StoreError("IDEMPOTENCY_CONFLICT", "Report key reused");
      return { applied: true as const, replayed: true };
    }
    const row = snapshot.stock.find(r => r.warehouse_id === event.warehouse_id && r.sku_id === event.sku_id);
    const day = snapshot.scenario.now_at.slice(0, 10);
    const validClock = (time: string) => time.startsWith(day + "T") && /^.{10}T\d\d:\d\d:00\+07:00$/.test(time);
    if (!row || (event.type === "stock_found" && row.on_hand > 2147483647 - event.quantity)
      || (event.type !== "stock_found" && !validClock(event.at))
      || (event.type === "delay" && Date.parse(event.at) <= Date.parse(row.ready_at))
      || (event.type === "resumed" && (!validClock(event.window_start) || !validClock(event.window_end)
        || event.at < event.window_start || event.at >= event.window_end))) throw new StoreError("INVALID_INPUT", "Invalid stock update");
    if (event.type === "stock_found") row.on_hand += event.quantity;
    if (event.type === "delay") {
      row.ready_at = event.at;
      // A later real report subsumes any fixed delay button for this SKU and location.
      const changes: Record<string, { warehouse_id: string; sku_id: string; ready_at: string }> = seeds.get(scenarioId)?.eventChanges ?? {};
      for (const [id, change] of Object.entries(changes)) {
        if (change.warehouse_id !== row.warehouse_id || change.sku_id !== row.sku_id || change.ready_at > event.at) continue;
        const preset = snapshot.scenario.demo_events.find(item => item.id === id);
        if (preset) preset.applied = true;
      }
    }
    if (event.type === "resumed") (snapshot.resumptions ??= []).push(event);
    row.report_revision = ++row.revision;
    prior.set(key.toLowerCase(), event);
    reports.set(scenarioId, prior);
    return { applied: true as const, replayed: false };
  }

  async reset(scenarioId?: ScenarioId): Promise<void> {
    if (scenarioId !== undefined) {
      const seed = seeds.get(scenarioId);
      if (!seed) throw new StoreError("INVALID_INPUT", "Unknown scenario");
      reports.delete(scenarioId);
      snapshots.set(scenarioId, structuredClone(seed.snapshot));
    } else {
      snapshots.clear();
      reports.clear();
      for (const [id, seed] of seeds) snapshots.set(id, structuredClone(seed.snapshot));
    }
  }

  async health() {
    return { storage: "memory" as const, degraded: false };
  }
}
