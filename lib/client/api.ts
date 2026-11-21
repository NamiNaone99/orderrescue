import type { ZodType } from "zod";
import {
  demoEventResponseSchema, demoResetResponseSchema, errorResponseSchema, healthResponseSchema,
  interpretResponseSchema, planResponseSchema, reservationResponseSchema, stateResponseSchema,
  type DemoEventRequest, type DemoResetRequest, type ErrorCode, type InterpretRequest, type PlanRequest,
  type ReservationRequest, type StateRequest,
  chatApplyResponseSchema, type ChatApply,
} from "@/lib/domain/contracts";

export class DeskApiError extends Error {
  constructor(readonly code: ErrorCode, readonly requestId: string | null, readonly status: number) {
    super(code);
    this.name = "DeskApiError";
  }
}

async function request<T>(path: string, schema: ZodType<T>, init: RequestInit = {}) {
  const deadline = AbortSignal.timeout(path === "interpret" ? 30_000 : 10_000);
  const signal = init.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
  let id: string | null = null;
  try {
    const response = await fetch("/api/" + path, { ...init, cache: "no-store", signal });
    id = response.headers.get("x-request-id");
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsed = errorResponseSchema.safeParse(body);
      const code = response.status === 429 ? "RATE_LIMITED" : parsed.success ? parsed.data.error.code : "INTERNAL";
      throw new DeskApiError(code, id ?? (parsed.success ? parsed.data.error.request_id : null), response.status);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new DeskApiError("INTERNAL", id, response.status);
    return parsed.data;
  } catch (error) {
    if (error instanceof DeskApiError) throw error;
    throw new DeskApiError("INTERNAL", id, 0);
  }
}

function post(body: unknown, signal?: AbortSignal, token?: string): RequestInit {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers["x-demo-token"] = token;
  return { method: "POST", headers, body: JSON.stringify(body), signal };
}

export const api = {
  health: (signal?: AbortSignal) => request("health", healthResponseSchema, { signal }),
  state: ({ scenario, sku }: StateRequest, signal?: AbortSignal) => {
    const query = new URLSearchParams({ scenario });
    if (sku) query.set("sku", sku);
    return request("state?" + query, stateResponseSchema, { signal });
  },
  interpret: (input: InterpretRequest, signal?: AbortSignal) => request("interpret", interpretResponseSchema, post(input, signal)),
  applyReport: (input: ChatApply, signal?: AbortSignal) => request("chat/apply", chatApplyResponseSchema, post(input, signal)),
  plan: (input: PlanRequest, signal?: AbortSignal) => request("plan", planResponseSchema, post(input, signal)),
  reserve: (input: ReservationRequest, signal?: AbortSignal) => request("reservations", reservationResponseSchema, post(input, signal)),
  event: (input: DemoEventRequest, signal?: AbortSignal) => request("demo/event", demoEventResponseSchema, post(input, signal)),
  reset: (input: DemoResetRequest, token?: string) => request("demo/reset", demoResetResponseSchema, post(input, undefined, token)),
};
