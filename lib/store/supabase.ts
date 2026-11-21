import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  orderStatusSchema, reservationRequestSchema, reservationResponseSchema, scenarioSchema,
  skuSchema, stateResponseSchema, stockRowSchema, warehouseIdSchema, warehouseSchema,
} from "@/lib/domain/contracts";
import type { ScenarioId } from "@/lib/domain/types";
import { filterSnapshot, stateVersion, StoreError, type SnapshotOptions, type Store, type StoreReservationRequest } from "./types";

// PostgREST serializes timestamptz using the database timezone. The public contract uses Bangkok.
const timestamp = z.iso.datetime({ offset: true }).transform(value =>
  new Date(Date.parse(value) + 7 * 3_600_000).toISOString().replace(/(?:\.000)?Z$/, "+07:00"));
const order = stateResponseSchema.shape.orders.element.omit({ lines: true }).extend({
  customer_ref: z.string().nullable(), received_at: timestamp, deadline_at: timestamp,
});
const orderLine = stateResponseSchema.shape.orders.element.shape.lines.element.extend({ order_id: z.string().min(1) });
const receipt = reservationResponseSchema.shape.receipt.extend({ created_at: timestamp });
const booking = reservationRequestSchema.extend({ scenario: z.string().min(1) });
const event = z.strictObject({
  applied: z.literal(true),
  stock: z.array(z.strictObject({ warehouse_id: warehouseIdSchema, sku_id: z.string(), revision: z.int().nonnegative() })),
  orders: z.array(z.strictObject({ id: z.string(), status: orderStatusSchema })),
});
const bookingErrors = z.enum(["INVALID_INPUT", "OVER_BUDGET", "STALE_STOCK", "IDEMPOTENCY_CONFLICT", "ORDER_ALREADY_RESERVED"]);
type QueryResult = { data: unknown; error: { message: string; code: string } | null };
type Query = PromiseLike<QueryResult>;

function unavailable() {
  return new StoreError("STORAGE_UNAVAILABLE", "Supabase storage is unavailable");
}

async function read<T>(query: Query, schema: z.ZodType<T>): Promise<T> {
  let result: QueryResult;
  try {
    result = await query;
  } catch {
    throw unavailable();
  }
  if (result.error) {
    const known = bookingErrors.safeParse(result.error.message);
    if (result.error.code === "P0001" && known.success) throw new StoreError(known.data, known.data);
    // Input conversion can fail in PostgREST before the PL/pgSQL function starts.
    if (["22003", "22023", "22P02"].includes(result.error.code)) {
      throw new StoreError("INVALID_INPUT", "Invalid database request");
    }
    throw unavailable();
  }
  const parsed = schema.safeParse(result.data);
  if (!parsed.success) throw unavailable();
  return parsed.data;
}

export class SupabaseStore<Id extends string = ScenarioId> implements Store<Id> {
  private connection?: SupabaseClient;

  private get client(): SupabaseClient {
    if (this.connection) return this.connection;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key || !URL.canParse(url) || new URL(url).protocol !== "https:") throw unavailable();
    this.connection = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    return this.connection;
  }

  async getSnapshot(scenarioId: Id, opts: SnapshotOptions = {}) {
    const schema = z.strictObject({
      scenario: scenarioSchema.extend({ id: z.literal(scenarioId), now_at: timestamp }),
      warehouses: z.array(warehouseSchema), skus: z.array(skuSchema),
      stock: z.array(stockRowSchema.safeExtend({ ready_at: timestamp })),
      orders: z.array(order), order_lines: z.array(orderLine),
      reservations: z.array(receipt.extend({ budget_thb: z.int().nonnegative() })),
    });
    const result = await read(this.client.from("scenario_snapshots")
      .select("scenario,warehouses,skus,stock,orders,order_lines,reservations")
      .eq("id", scenarioId).maybeSingle(), schema.nullable());
    if (!result) throw new StoreError("INVALID_INPUT", "Unknown scenario");
    return filterSnapshot<Id>(result, opts);
  }

  async reserve(input: StoreReservationRequest<Id>) {
    const parsed = booking.safeParse(input);
    if (!parsed.success) throw new StoreError("INVALID_INPUT", "Invalid reservation request");
    const request = parsed.data;
    // The five RPC parameters cover the booking. PostgREST transaction metadata carries
    // the incident references so PostgreSQL can validate them after replay and budget.
    const incident = Buffer.from(JSON.stringify([request.incident.warehouse_id, request.incident.sku_id])).toString("base64");
    return read(this.client.rpc("reserve_plan", {
      p_scenario: request.scenario, p_key: request.idempotency_key.toLowerCase(), p_plan_hash: request.plan_hash,
      p_budget: request.budget_thb, p_lines: request.lines,
    }).setHeader("x-orderrescue-incident", incident), reservationResponseSchema.extend({ receipt }));
  }

  async applyDemoEvent(scenarioId: Id, eventId: string) {
    const result = await read(this.client.rpc("apply_demo_event", { p_scenario: scenarioId, p_event_id: eventId }), event);
    return { applied: result.applied, state_version: stateVersion(result) };
  }

  async reset(scenarioId?: Id) {
    await read(this.client.rpc("reset_demo", { p_scenario: scenarioId ?? null }), z.null());
  }

  async health() {
    await read(this.client.from("scenarios").select("id").limit(1), z.array(z.strictObject({ id: z.string() })));
    return { storage: "supabase" as const, degraded: false };
  }
}
