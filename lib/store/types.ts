import { createHash } from "node:crypto";
import type { DemoEventResponse, ReservationRequest, ReservationResponse } from "@/lib/domain/contracts";
import type { ErrorCode, Scenario, ScenarioId, Snapshot } from "@/lib/domain/types";

// The database contract can use a private seed ID while routes retain the public scenario union.
export type StoreReservationRequest<Id extends string = ScenarioId> =
  Omit<ReservationRequest, "scenario"> & { scenario: Id };

export type StoreSnapshot<Id extends string = ScenarioId> = Omit<Snapshot, "scenario"> & {
  scenario: Omit<Scenario, "id"> & { id: Id };
  state_version: string;
};

export interface SnapshotOptions {
  sku?: string;
  openSkusOnly?: boolean;
}

export interface Store<Id extends string = ScenarioId> {
  getSnapshot(scenarioId: Id, opts?: SnapshotOptions): Promise<StoreSnapshot<Id>>;
  reserve(request: StoreReservationRequest<Id>): Promise<ReservationResponse>;
  applyDemoEvent(scenarioId: Id, eventId: string): Promise<DemoEventResponse>;
  reset(scenarioId?: Id): Promise<void>;
  health(): Promise<{ storage: "memory" | "supabase"; degraded: boolean }>;
}

export class StoreError extends Error {
  constructor(readonly code: ErrorCode, message: string) {
    super(message);
    this.name = "StoreError";
  }
}

function compareKeys(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Version the entire scenario even when a caller requests a single SKU. */
export function stateVersion(snapshot: {
  stock: Pick<Snapshot["stock"][number], "warehouse_id" | "sku_id" | "revision">[];
  orders: Pick<Snapshot["orders"][number], "id" | "status">[];
}): string {
  const stock = snapshot.stock.map(({ warehouse_id, sku_id, revision }) => [warehouse_id, sku_id, revision] as const)
    .sort((a, b) => compareKeys(a[0], b[0]) || compareKeys(a[1], b[1]));
  const orders = snapshot.orders.map(({ id, status }) => [id, status] as const)
    .sort((a, b) => compareKeys(a[0], b[0]));
  return createHash("sha256").update(JSON.stringify({ stock, orders })).digest("hex");
}

/** Filter after hashing the whole scenario so a filtered read carries the same version. */
export function filterSnapshot<Id extends string>(snapshot: Omit<StoreSnapshot<Id>, "state_version">, opts: SnapshotOptions): StoreSnapshot<Id> {
  const state_version = stateVersion(snapshot);
  if (opts.sku === undefined && !opts.openSkusOnly) return { ...snapshot, state_version };
  if (opts.sku !== undefined && !snapshot.skus.some(sku => sku.id === opts.sku)) {
    throw new StoreError("INVALID_INPUT", "Unknown SKU in this scenario");
  }
  const open = new Set(snapshot.orders.filter(order => order.status === "open").map(order => order.id));
  const visible = opts.sku !== undefined ? new Set([opts.sku])
    : new Set(snapshot.order_lines.filter(line => open.has(line.order_id)).map(line => line.sku_id));
  const order_lines = snapshot.order_lines.filter(line => visible.has(line.sku_id));
  const orderIds = new Set(order_lines.map(line => line.order_id));
  return {
    ...snapshot, state_version, order_lines,
    skus: snapshot.skus.filter(sku => visible.has(sku.id)),
    stock: snapshot.stock.filter(row => visible.has(row.sku_id)),
    orders: snapshot.orders.filter(order => orderIds.has(order.id)),
  };
}
