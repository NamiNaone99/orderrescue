import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ErrorCode } from "@/lib/domain/contracts";
import { InvalidMessageError } from "@/lib/interpreter/validate";
import { StoreError } from "@/lib/store/types";

const errors = {
  INVALID_INPUT: [422, "Invalid request."],
  RATE_LIMITED: [429, "Too many requests. Try again shortly."],
  PLAN_HASH_MISMATCH: [422, "The confirmed lines do not match the plan."],
  OVER_BUDGET: [422, "The confirmed lines exceed the budget."],
  STALE_STOCK: [409, "Stock has changed. Refresh the plan."],
  IDEMPOTENCY_CONFLICT: [409, "This confirmation key belongs to another plan."],
  ORDER_ALREADY_RESERVED: [409, "An order has already been reserved."],
  UNAUTHORIZED: [401, "A valid demo reset token is required."],
  STORAGE_UNAVAILABLE: [503, "Storage is temporarily unavailable."],
  INTERNAL: [500, "An unexpected error occurred."],
} as const satisfies Record<ErrorCode, readonly [number, string]>;

export class ApiError extends Error {
  constructor(readonly code: ErrorCode) {
    super(errors[code][1]);
    this.name = "ApiError";
  }
}

function parseInput<T>(input: unknown, schema: z.ZodType<T>): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new ApiError("INVALID_INPUT");
  return result.data;
}

export function readQuery<T>(request: Request, schema: z.ZodType<T>): T {
  const query = new URL(request.url).searchParams;
  const entries = new Map<string, string>();
  for (const [key, value] of query) {
    if (entries.has(key)) throw new ApiError("INVALID_INPUT");
    entries.set(key, value);
  }
  return parseInput(Object.fromEntries(entries), schema);
}

export async function readBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    throw new ApiError("INVALID_INPUT");
  }
  return parseInput(input, schema);
}

type RouteResult = { body: unknown; status?: number };
type RequestLog = { messageLength?: number; receiptId?: string };

export async function apiRoute(request: Request, handle: (log: RequestLog) => Promise<RouteResult> | RouteResult): Promise<Response> {
  // Read the URL before creating the UUID so Next serves GET responses per request.
  const url = new URL(request.url);
  const requestId = randomUUID();
  const log: RequestLog = {};
  const headers = { "x-request-id": requestId, "cache-control": "no-store" };
  let response: Response;
  let code: ErrorCode | undefined;
  try {
    if (request.method === "POST" && url.searchParams.size > 0) throw new ApiError("INVALID_INPUT");
    const { body, status = 200 } = await handle(log);
    response = Response.json(body, { status, headers });
  } catch (error) {
    code = error instanceof StoreError || error instanceof ApiError || error instanceof InvalidMessageError
      ? error.code : "INTERNAL";
    const [status, message] = errors[code];
    response = Response.json({ error: { code, message, request_id: requestId } }, { status, headers });
  }
  console.info(JSON.stringify({
    request_id: requestId, method: request.method, status: response.status, code,
    message_length: log.messageLength, receipt_id: log.receiptId,
  }));
  return response;
}
