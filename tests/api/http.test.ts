import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as health } from "@/app/api/health/route";
import { POST as book } from "@/app/api/reservations/route";
import { GET as state } from "@/app/api/state/route";
import { errorResponseSchema, type ReservationRequest } from "@/lib/domain/contracts";
import { planHash } from "@/lib/planner/hash";
import { heroTime } from "@/lib/scenarios/hero";
import { getStore } from "@/lib/store";
import { StoreError } from "@/lib/store/types";

afterEach(() => vi.restoreAllMocks());

const confirmedLine = {
  order_id: "101", sku_id: "SKU-X", warehouse_id: "B", qty: 8, unit_cost_thb: 4, expected_revision: 1,
} as const;

function reservation(): ReservationRequest {
  const incident = { warehouse_id: "A", sku_id: "SKU-X", window_start: heroTime("13:00"), window_end: heroTime("18:00") } as const;
  const lines = [confirmedLine];
  return { scenario: "hero", incident, budget_thb: 100, idempotency_key: randomUUID(), lines,
    plan_hash: planHash("hero", incident, 100, lines) };
}

function post(body: string, query = ""): Request {
  return new Request("http://localhost/api/reservations" + query, {
    method: "POST", body, headers: { "content-type": "application/json" },
  });
}

describe("shared HTTP boundary", () => {
  it("generates fresh request IDs for successful reads and forbids response caching", async () => {
    const suppliedId = randomUUID();
    const request = new Request("http://localhost/api/health", { headers: { "x-request-id": suppliedId } });
    const first = await health(request);
    const second = await health(request);
    const ids = [first, second].map(response => response.headers.get("x-request-id"));
    expect([first.status, second.status]).toEqual([200, 200]);
    expect(ids.every(id => errorResponseSchema.shape.error.shape.request_id.safeParse(id).success)).toBe(true);
    expect(new Set([...ids, suppliedId]).size).toBe(3);
    expect(first.headers.get("cache-control")).toBe("no-store");
  });

  it.each(["?scenario=hero&scenario=hero", "?scenario=hero&extra=1"])("rejects an ambiguous or unknown query %s", async query => {
    const response = await state(new Request("http://localhost/api/state" + query));
    const { error } = errorResponseSchema.parse(await response.json());
    expect(response.status).toBe(422);
    expect(error).toMatchObject({ code: "INVALID_INPUT", request_id: response.headers.get("x-request-id") });
  });

  it.each([
    ["malformed JSON", "{", ""],
    ["unknown JSON key", JSON.stringify({ ...reservation(), extra: true }), ""],
    ["unexpected POST query", JSON.stringify(reservation()), "?extra=1"],
  ])("rejects %s before calling the store", async (_label, body, query) => {
    const reserve = vi.spyOn(getStore(), "reserve");
    const response = await book(post(body, query));
    const { error } = errorResponseSchema.parse(await response.json());
    expect(response.status).toBe(422);
    expect(error).toMatchObject({ code: "INVALID_INPUT", request_id: response.headers.get("x-request-id") });
    expect(reserve).not.toHaveBeenCalled();
  });

  it.each([
    [503, "STORAGE_UNAVAILABLE", new StoreError("STORAGE_UNAVAILABLE", "private diagnostic")],
    [500, "INTERNAL", new Error("private diagnostic")],
  ] as const)("returns a sanitized store failure with status %i", async (status, code, failure) => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const reserve = vi.spyOn(getStore(), "reserve").mockRejectedValue(failure);
    const response = await book(post(JSON.stringify(reservation())));
    const { error } = errorResponseSchema.parse(await response.json());
    expect(reserve).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(status);
    expect(error).toMatchObject({ code, request_id: response.headers.get("x-request-id") });
    expect(error.message).not.toContain("private diagnostic");
    expect(log).toHaveBeenCalledWith(JSON.stringify({ request_id: error.request_id, method: "POST", status, code }));
  });
});
