import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST as event } from "@/app/api/demo/event/route";
import { POST as reset } from "@/app/api/demo/reset/route";
import { POST as interpret } from "@/app/api/interpret/route";
import { POST as plan } from "@/app/api/plan/route";
import { POST as reserve } from "@/app/api/reservations/route";
import { errorResponseSchema, interpretResponseSchema, type ErrorCode, type PlanRequest } from "@/lib/domain/contracts";
import * as runtime from "@/lib/interpreter/runtime";
import { planHash } from "@/lib/planner/hash";
import { heroSampleMessages, heroTime } from "@/lib/scenarios/hero";
import { getStore } from "@/lib/store";

const limit = 16 * 1024;
const handlers = { plan, reservations: reserve, interpret, "demo/event": event, "demo/reset": reset };
type Route = keyof typeof handlers;
const planInput: PlanRequest = { scenario: "hero", budget_thb: 100, incident: {
  warehouse_id: "A", sku_id: "SKU-X", window_start: heroTime("13:00"), window_end: heroTime("18:00"),
} };
const lines = [{ order_id: "101", sku_id: "SKU-X", warehouse_id: "B", qty: 8, unit_cost_thb: 4, expected_revision: 1 }] as const;
const bodies = {
  plan: planInput,
  reservations: { ...planInput, lines, idempotency_key: randomUUID(), plan_hash: planHash("hero", planInput.incident, 100, [...lines]) },
  interpret: { scenario: "hero", message: heroSampleMessages[0].text },
  "demo/event": { scenario: "hero", event_id: "b-slips-1430" },
  "demo/reset": { scenario: "hero" },
};

function post(path: Route, body: BodyInit = JSON.stringify(bodies[path]), headers: Record<string, string> = {}) {
  const init = { method: "POST", headers: { "content-type": "application/json", ...headers }, body, duplex: "half" };
  return handlers[path](new Request("http://localhost/api/" + path, init));
}

function padded(path: Route, size: number) {
  const json = JSON.stringify(bodies[path]);
  return json + " ".repeat(size - Buffer.byteLength(json));
}

async function expectError(response: Response, status: number, code: ErrorCode) {
  expect(response.status).toBe(status);
  const { error } = errorResponseSchema.parse(await response.json());
  expect(error).toMatchObject({ code, request_id: response.headers.get("x-request-id") });
}

beforeEach(async () => {
  vi.stubGlobal("orderRescuePlanningBucket", undefined);
  vi.stubEnv("STORAGE_MODE", "memory");
  vi.stubEnv("INTERPRETER_MODE", "offline");
  vi.spyOn(console, "info").mockImplementation(() => {});
  await getStore().reset("hero");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it.each(Object.keys(handlers) as Route[])("rejects 16,385 actual bytes on %s before any store or interpreter work", async path => {
  const store = getStore();
  const operations = [vi.spyOn(store, "getSnapshot"), vi.spyOn(store, "reserve"), vi.spyOn(store, "reset"),
    vi.spyOn(store, "applyDemoEvent"), vi.spyOn(runtime, "getInterpreterRuntime")];
  await expectError(await post(path, padded(path, limit + 1)), 413, "INVALID_INPUT");
  for (const operation of operations) expect(operation).not.toHaveBeenCalled();
});

it("accepts exactly 16,384 bytes across a split Thai character, even if the length header overstates the body", async () => {
  const body = Buffer.from(padded("interpret", limit));
  const split = body.indexOf(Buffer.from(heroSampleMessages[0].text)) + 1;
  const stream = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(body.subarray(0, split));
    controller.enqueue(body.subarray(split));
    controller.close();
  } });
  const response = await post("interpret", stream, { "content-length": String(limit + 1) });
  expect(response.status).toBe(200);
  expect(interpretResponseSchema.parse(await response.json()).outcome).toBe("incident");
});

it("stops reading at the first oversized chunk when the length header understates the body", async () => {
  const chunks = [Buffer.from(padded("interpret", limit)), Buffer.from(" "), Buffer.from(" ")];
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({ pull(controller) {
    const next = chunks.shift();
    if (next) controller.enqueue(next);
    else controller.close();
  }, cancel }, { highWaterMark: 0 });
  await expectError(await post("interpret", stream, { "content-length": "2" }), 413, "INVALID_INPUT");
  expect(cancel).toHaveBeenCalledOnce();
  expect(chunks).toHaveLength(1);
});

it("still reports malformed JSON at the limit as 422", async () => {
  await expectError(await post("interpret", "{".padEnd(limit)), 422, "INVALID_INPUT");
});

it("shares 20 admissions across plan and reservations per trusted IP and refills one token per second", async () => {
  vi.stubEnv("VERCEL", "1");
  let now = 0;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  const client = { "x-vercel-forwarded-for": "192.0.2.41" };
  const other = { "x-vercel-forwarded-for": "192.0.2.42" };
  for (let i = 0; i < 10; i++) {
    expect((await post("plan", undefined, client)).status).toBe(200);
    expect((await post("reservations", undefined, client)).status).toBe(i === 0 ? 201 : 200);
  }
  const read = vi.spyOn(getStore(), "getSnapshot");
  const book = vi.spyOn(getStore(), "reserve");
  await expectError(await post("plan", undefined, client), 429, "RATE_LIMITED");
  now = 999;
  await expectError(await post("reservations", undefined, client), 429, "RATE_LIMITED");
  expect(read).not.toHaveBeenCalled();
  expect(book).not.toHaveBeenCalled();
  expect((await post("plan", undefined, other)).status).toBe(200);
  now = 1000;
  expect((await post("reservations", undefined, client)).status).toBe(200);
  await expectError(await post("plan", undefined, client), 429, "RATE_LIMITED");
});
