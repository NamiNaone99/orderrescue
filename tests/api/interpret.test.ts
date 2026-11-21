import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/interpret/route";
import { errorResponseSchema, interpretResponseSchema } from "@/lib/domain/contracts";
import type { InterpreterClient } from "@/lib/interpreter";
import * as runtime from "@/lib/interpreter/runtime";
import { InterpreterQuota, TokenBucket } from "@/lib/ratelimit";
import { heroSampleMessages } from "@/lib/scenarios/hero";
import { getStore } from "@/lib/store";

const sample = heroSampleMessages[0];
const firstIp = "192.0.2.1";
const secondIp = "192.0.2.2";

function request(message: string = sample.text, ip = firstIp) {
  return new Request("http://localhost/api/interpret", {
    method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ scenario: "hero", message }),
  });
}

async function interpretMessage(ip = firstIp) {
  const response = await POST(request(sample.text, ip));
  expect(response.status).toBe(200);
  expect(response.headers.get("x-request-id")).toBeTruthy();
  return interpretResponseSchema.parse(await response.json());
}

function fakeClient(model = "primary") {
  return {
    name: `openai:${model}` as const,
    run: vi.fn<InterpreterClient["run"]>().mockResolvedValue({ status: "parsed", output: sample.expected }),
  };
}

function useClients(...clients: InterpreterClient[]) {
  const configure = runtime.getInterpreterRuntime;
  vi.spyOn(runtime, "getInterpreterRuntime").mockImplementation(() => configure(clients));
}

beforeEach(() => {
  vi.stubGlobal("orderRescueInterpretQuota", undefined);
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("INTERPRETER_MODE", "openai");
  vi.stubEnv("OPENAI_API_KEY", "test-only");
  vi.stubEnv("INTERPRET_BURST", "2");
  vi.stubEnv("INTERPRET_REFILL_MS", "2000");
  vi.stubEnv("INTERPRET_DAILY_CAP", "500");
  vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 10, 21));
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("POST /api/interpret", () => {
  it("returns the validated offline hero incident when no key is configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(runtime.getInterpreterMode()).toEqual({ interpreter: "offline", model: null });
    expect(await interpretMessage()).toMatchObject({
      outcome: "incident", incident: { warehouse_id: "A", sku_ids: ["SKU-X"] },
      interpreter: { used: "offline", rate_limited: false },
    });
    const records = vi.mocked(console.info).mock.calls.map(([record]) => JSON.parse(record));
    expect(records).toEqual([{
      request_id: expect.any(String), method: "POST", status: 200, message_length: sample.text.length,
    }]);
  });

  it("rejects a 501-character message before storage, providers or quota", async () => {
    vi.stubEnv("INTERPRET_DAILY_CAP", "1");
    const primary = fakeClient();
    useClients(primary);
    const snapshot = vi.spyOn(getStore(), "getSnapshot");
    const response = await POST(request("ก".repeat(501)));
    expect(response.status).toBe(422);
    expect(errorResponseSchema.parse(await response.json()).error).toMatchObject({
      code: "INVALID_INPUT", request_id: response.headers.get("x-request-id"),
    });
    expect(snapshot).not.toHaveBeenCalled();
    expect(primary.run).not.toHaveBeenCalled();
    expect((await interpretMessage()).interpreter.used).toBe(primary.name);
  });

  it("serves the third request offline at burst two and keeps IP buckets independent", async () => {
    const primary = fakeClient();
    useClients(primary);
    for (let i = 0; i < 2; i++) expect((await interpretMessage()).interpreter.used).toBe(primary.name);
    const limited = await interpretMessage();
    expect(limited.interpreter).toMatchObject({ used: "offline", rate_limited: true, attempts: [{ name: "offline", ok: true }] });
    expect((await interpretMessage(secondIp)).interpreter.used).toBe(primary.name);
    expect(primary.run).toHaveBeenCalledTimes(3);
  });

  it.each(["offline", "missing key"])("skips quota and client work for %s", async reason => {
    vi.stubEnv("INTERPRET_DAILY_CAP", "1");
    if (reason === "offline") vi.stubEnv("INTERPRETER_MODE", "offline");
    else vi.stubEnv("OPENAI_API_KEY", "");
    const primary = fakeClient();
    useClients(primary);
    for (let i = 0; i < 3; i++) {
      expect((await interpretMessage()).interpreter).toMatchObject({ used: "offline", rate_limited: false });
    }
    expect(primary.run).not.toHaveBeenCalled();
    vi.stubEnv("INTERPRETER_MODE", "openai");
    vi.stubEnv("OPENAI_API_KEY", "test-only");
    expect((await interpretMessage()).interpreter.used).toBe(primary.name);
  });

  it("reports a failed provider attempt when the offline fallback answers", async () => {
    const primary = fakeClient();
    primary.run.mockResolvedValue({ status: "refusal" });
    useClients(primary);
    expect((await interpretMessage()).interpreter).toMatchObject({
      used: "offline", rate_limited: false,
      attempts: [{ name: primary.name, ok: false, reason: "refusal" }, { name: "offline", ok: true }],
    });
  });

  it("checks the per-instance daily cap before a fallback model or another IP can call", async () => {
    vi.stubEnv("INTERPRET_DAILY_CAP", "1");
    const primary = fakeClient();
    const fallback = fakeClient("fallback");
    primary.run.mockResolvedValue({ status: "incomplete" });
    useClients(primary, fallback);
    expect((await interpretMessage()).interpreter).toMatchObject({
      used: "offline", rate_limited: true,
      attempts: [{ name: primary.name, ok: false, reason: "incomplete" }, { name: "offline", ok: true }],
    });
    expect((await interpretMessage(secondIp)).interpreter.rate_limited).toBe(true);
    expect(primary.run).toHaveBeenCalledTimes(1);
    expect(fallback.run).not.toHaveBeenCalled();
  });
});

describe("model quotas", () => {
  it("refills exactly one token at each interval up to the configured burst", () => {
    let now = 0;
    const bucket = new TokenBucket(2, 1000, () => now);
    expect([bucket.take(firstIp), bucket.take(firstIp), bucket.take(firstIp)]).toEqual([true, true, false]);
    now = 999;
    expect(bucket.take(firstIp)).toBe(false);
    now = 1000;
    expect(bucket.take(firstIp)).toBe(true);
    expect(bucket.take(firstIp)).toBe(false);
    now = 600_000;
    expect([bucket.take(firstIp), bucket.take(firstIp), bucket.take(firstIp)]).toEqual([true, true, false]);
  });

  it("charges the IP once per request and renews the global allowance at UTC midnight", () => {
    let now = Date.UTC(2026, 10, 21, 23, 59, 59);
    const quota = new InterpreterQuota({ burst: 1, refillMs: 5000, dailyCap: 2 }, () => now);
    const first = quota.forRequest(firstIp);
    expect([first(), first()]).toEqual([true, true]);
    expect(quota.forRequest(secondIp)()).toBe(false);
    now += 1000;
    expect(quota.forRequest(firstIp)()).toBe(false);
    expect(quota.forRequest(secondIp)()).toBe(true);
  });
});
