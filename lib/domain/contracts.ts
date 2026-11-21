import { z } from "zod";
import { isBangkokTimestamp } from "./time";

const text = z.string().min(1);
const nonnegativeInteger = z.int().nonnegative();
const quantity = z.int().positive();
const timestamp = z.string().refine(isBangkokTimestamp, "Expected an ISO timestamp with +07:00");
const clockTime = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const planHash = z.string().regex(/^[0-9a-f]{64}$/);

export const scenarioIdSchema = z.enum(["hero", "real-day"]);
export const warehouseIdSchema = z.enum(["A", "B", "C"]);
export const orderStatusSchema = z.enum(["open", "reserved", "needs_human"]);
export const errorCodeSchema = z.enum([
  "INVALID_INPUT", "RATE_LIMITED", "PLAN_HASH_MISMATCH", "OVER_BUDGET",
  "STALE_STOCK", "IDEMPOTENCY_CONFLICT", "ORDER_ALREADY_RESERVED",
  "UNAUTHORIZED", "STORAGE_UNAVAILABLE", "INTERNAL",
]);

export const errorResponseSchema = z.strictObject({
  error: z.strictObject({ code: errorCodeSchema, message: text, request_id: z.uuid() }),
});

export const healthRequestSchema = z.strictObject({});
const healthFields = {
  ok: z.literal(true),
  storage: z.enum(["memory", "supabase"]),
  degraded: z.boolean(),
  commit: text,
};
export const healthResponseSchema = z.discriminatedUnion("interpreter", [
  z.strictObject({ ...healthFields, interpreter: z.literal("offline"), model: z.null() }),
  z.strictObject({ ...healthFields, interpreter: z.literal("openai"), model: text }),
]);

export const stateRequestSchema = z.strictObject({
  scenario: scenarioIdSchema,
  sku: text.optional(),
});

export const scenarioSchema = z.strictObject({
  id: scenarioIdSchema,
  name_th: text,
  name_en: text,
  kind: z.enum(["synthetic", "real_derived"]),
  now_at: timestamp,
  default_budget_thb: nonnegativeInteger,
  shifts: z.array(
    z.strictObject({ name_th: text, start: clockTime, end: clockTime })
      .refine(({ start, end }) => start < end, {
        path: ["end"], message: "Shift end must follow its start",
      }),
  ),
  default_sku_id: text,
  sample_messages: z.array(z.strictObject({ text: text.max(500), label_th: text })),
  demo_events: z.array(z.strictObject({
    id: text, label_th: text, label_en: text, applied: z.boolean(),
  })),
});

export const warehouseSchema = z.strictObject({
  id: warehouseIdSchema,
  name_th: text,
  is_home: z.boolean(),
});
export const skuSchema = z.strictObject({ id: text, name: text });
export const stockRowSchema = z.strictObject({
  warehouse_id: warehouseIdSchema,
  sku_id: text,
  on_hand: nonnegativeInteger,
  committed: nonnegativeInteger,
  ready_at: timestamp,
  extra_cost_per_unit_thb: nonnegativeInteger,
  revision: nonnegativeInteger,
  report_revision: nonnegativeInteger.optional(),
}).refine((row) => row.committed <= row.on_hand, {
  path: ["committed"], message: "Committed stock exceeds stock on hand",
});

// Confirmation sends only the six fields covered by the plan hash.
export const reservationLineSchema = z.strictObject({
  order_id: text,
  sku_id: text,
  warehouse_id: warehouseIdSchema,
  qty: quantity,
  unit_cost_thb: nonnegativeInteger,
  expected_revision: nonnegativeInteger,
});
export const planLineSchema = reservationLineSchema.extend({
  ready_at: timestamp,
  deadline_at: timestamp,
});
const reservationSummarySchema = z.strictObject({
  id: z.uuid(),
  created_at: timestamp,
  total_extra_cost_thb: nonnegativeInteger,
  lines: z.array(reservationLineSchema),
});

export const stateResponseSchema = z.strictObject({
  scenario: scenarioSchema,
  warehouses: z.array(warehouseSchema),
  skus: z.array(skuSchema),
  stock: z.array(stockRowSchema.safeExtend({ free: nonnegativeInteger }).refine(
    (row) => row.free === row.on_hand - row.committed,
    { path: ["free"], message: "Free stock must equal on hand minus committed" },
  )),
  orders: z.array(z.strictObject({
    id: text,
    received_at: timestamp,
    deadline_at: timestamp,
    home_warehouse_id: warehouseIdSchema,
    status: orderStatusSchema,
    lines: z.array(z.strictObject({ sku_id: text, qty: quantity })),
  })),
  reservations: z.array(reservationSummarySchema),
  state_version: text,
});

const messageRequestSchema = z.strictObject({
  scenario: scenarioIdSchema,
  message: z.string().trim().min(1).max(500),
});

const windowFields = { window_start: timestamp, window_end: timestamp };
function isOrderedWindow(window: { window_start: string; window_end: string }) {
  return Date.parse(window.window_start) < Date.parse(window.window_end);
}
const windowError = { path: ["window_end"], message: "Window end must follow its start" };
export const planIncidentSchema = z.strictObject({
  warehouse_id: warehouseIdSchema,
  sku_id: text,
  ...windowFields,
}).refine(isOrderedWindow, windowError);

export const chatContextSchema = z.strictObject({ incident: planIncidentSchema.nullable() });
export const interpretRequestSchema = messageRequestSchema.extend({ chat: chatContextSchema.optional() });
const eventTarget = { warehouse_id: warehouseIdSchema, sku_id: text };
export const resumedEventSchema = z.strictObject({
  type: z.literal("resumed"), ...eventTarget, at: timestamp, ...windowFields,
}).refine(isOrderedWindow, windowError);
export const warehouseEventSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("delay"), ...eventTarget, at: timestamp }),
  z.strictObject({ type: z.literal("stock_found"), ...eventTarget, quantity: quantity.max(10000) }),
  resumedEventSchema,
]);
export type WarehouseEvent = z.infer<typeof warehouseEventSchema>;
export type ChatContext = z.infer<typeof chatContextSchema>;
export const chatApplySchema = z.strictObject({
  scenario: scenarioIdSchema, key: z.uuid(), message: messageRequestSchema.shape.message,
  evidence_quote: text, event: warehouseEventSchema, chat: chatContextSchema,
});
export type ChatApply = z.infer<typeof chatApplySchema>;
export const chatApplyResponseSchema = z.strictObject({ applied: z.literal(true), replayed: z.boolean() });
const interpretedIncident = z.strictObject({
  warehouse_id: warehouseIdSchema,
  sku_ids: z.array(text).min(1),
  ...windowFields,
  evidence_quote: text,
}).refine(isOrderedWindow, windowError);

const interpreterName = z.union([z.literal("offline"), z.string().regex(/^openai:\S+$/)]);
const interpretMetadata = {
  interpreter: z.strictObject({
    used: interpreterName,
    attempts: z.array(z.strictObject({
      name: interpreterName, ok: z.boolean(), reason: text.optional(),
    })),
    latency_ms: nonnegativeInteger,
    rate_limited: z.boolean(),
  }),
  validation: z.strictObject({ ok: z.boolean(), issues: z.array(text) }),
};
export const interpretResponseSchema = z.discriminatedUnion("outcome", [
  z.strictObject({
    ...interpretMetadata, outcome: z.literal("event"), event: warehouseEventSchema, evidence_quote: text,
    incident: z.null(), clarification: z.null(),
  }),
  z.strictObject({
    ...interpretMetadata,
    outcome: z.literal("incident"),
    event_type: z.literal("outage").optional(),
    incident: interpretedIncident,
    clarification: z.null(),
  }),
  z.strictObject({
    ...interpretMetadata,
    outcome: z.literal("clarification"),
    incident: z.null(),
    clarification: z.strictObject({
      about: z.enum(["warehouse", "sku", "time", "conflict", "other"]),
      question_th: text,
    }),
  }),
  z.strictObject({
    ...interpretMetadata,
    outcome: z.literal("ignore"),
    incident: z.null(),
    clarification: z.null(),
  }),
]);

export const planRequestSchema = z.strictObject({
  scenario: scenarioIdSchema,
  incident: planIncidentSchema,
  budget_thb: nonnegativeInteger,
});
export const strategyResultSchema = z.strictObject({
  on_time: nonnegativeInteger,
  total: nonnegativeInteger,
  extra_cost_thb: nonnegativeInteger,
  lines: z.array(planLineSchema),
  needs_human: z.array(z.strictObject({
    order_id: text,
    reason: z.enum(["NO_STOCK", "NO_ON_TIME_SOURCE", "OVER_BUDGET", "NOT_SELECTED"]),
  })),
});
export const planResponseSchema = z.strictObject({
  effective_window_end: timestamp.optional(),
  report_revisions: z.array(z.strictObject({ warehouse_id: warehouseIdSchema, sku_id: text, revision: nonnegativeInteger })).optional(),
  affected: z.array(z.strictObject({
    order_id: text, qty: quantity, received_at: timestamp, deadline_at: timestamp,
  })),
  first_come: strategyResultSchema,
  joint: strategyResultSchema,
  solver: z.strictObject({
    mode: z.literal("branch_and_bound"),
    optimality: z.enum(["proven", "best_found"]),
    nodes: nonnegativeInteger,
    node_limit: nonnegativeInteger,
  }),
  budget_thb: nonnegativeInteger,
  plan_hash: planHash,
  state_version: text,
});

export const reservationRequestSchema = planRequestSchema.extend({
  idempotency_key: z.uuid(),
  plan_hash: planHash,
  lines: z.array(reservationLineSchema).min(1),
});
export const reservationResponseSchema = z.strictObject({
  receipt: reservationSummarySchema.extend({ idempotency_key: z.uuid(), plan_hash: planHash }),
  replayed: z.boolean(),
});

export const demoEventRequestSchema = z.strictObject({ scenario: scenarioIdSchema, event_id: text });
export const demoEventResponseSchema = z.strictObject({ applied: z.boolean(), state_version: text });
export const demoResetRequestSchema = z.strictObject({ scenario: scenarioIdSchema.optional() });
export const demoResetResponseSchema = z.strictObject({ ok: z.literal(true) });

export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type HealthRequest = z.infer<typeof healthRequestSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type StateRequest = z.infer<typeof stateRequestSchema>;
export type StateResponse = z.infer<typeof stateResponseSchema>;
export type InterpretRequest = z.infer<typeof interpretRequestSchema>;
export type InterpretResponse = z.infer<typeof interpretResponseSchema>;
export type PlanRequest = z.infer<typeof planRequestSchema>;
export type PlanResponse = z.infer<typeof planResponseSchema>;
export type ReservationRequest = z.infer<typeof reservationRequestSchema>;
export type ReservationResponse = z.infer<typeof reservationResponseSchema>;
export type DemoEventRequest = z.infer<typeof demoEventRequestSchema>;
export type DemoEventResponse = z.infer<typeof demoEventResponseSchema>;
export type DemoResetRequest = z.infer<typeof demoResetRequestSchema>;
export type DemoResetResponse = z.infer<typeof demoResetResponseSchema>;
