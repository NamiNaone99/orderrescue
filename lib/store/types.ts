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
export function stateVersion(snapshot: Pick<Snapshot, "stock" | "orders">): string {
  const stock = snapshot.stock.map(({ warehouse_id, sku_id, revision }) => [warehouse_id, sku_id, revision] as const)
    .sort((a, b) => compareKeys(a[0], b[0]) || compareKeys(a[1], b[1]));
  const orders = snapshot.orders.map(({ id, status }) => [id, status] as const)
    .sort((a, b) => compareKeys(a[0], b[0]));
  return createHash("sha256").update(JSON.stringify({ stock, orders })).digest("hex");
}
