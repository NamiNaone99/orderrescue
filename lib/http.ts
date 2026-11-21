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
  constructor(readonly code: ErrorCode, readonly status: number = errors[code][0]) {
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

const maxBodyBytes = 16 * 1024;

export async function readBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  if (!request.body || request.body.locked) throw new ApiError("INVALID_INPUT");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  let input: unknown;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBodyBytes) {
        // A slow or disconnected sender must not delay the response during cancellation.
        void reader.cancel().catch(() => {});
        throw new ApiError("INVALID_INPUT", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    input = JSON.parse(text + decoder.decode());
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("INVALID_INPUT");
  } finally {
    reader.releaseLock();
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
    const [defaultStatus, message] = errors[code];
    const status = error instanceof ApiError ? error.status : defaultStatus;
    response = Response.json({ error: { code, message, request_id: requestId } }, { status, headers });
  }
  console.info(JSON.stringify({
    request_id: requestId, method: request.method, status: response.status, code,
    message_length: log.messageLength, receipt_id: log.receiptId,
  }));
  return response;
}
