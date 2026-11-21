import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/demo/reset/route";
import { demoResetResponseSchema, errorResponseSchema } from "@/lib/domain/contracts";
import { getStore } from "@/lib/store";

function request(body: object, token?: string, ip = "192.0.2.10") {
  const headers = new Headers({ "content-type": "application/json", "x-forwarded-for": ip });
  if (token !== undefined) headers.set("x-demo-token", token);
  return new Request("http://localhost/api/demo/reset", { method: "POST", headers, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.stubGlobal("orderRescueHeroResets", undefined);
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("DEMO_RESET_TOKEN", "privileged-test-reset");
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("POST /api/demo/reset", () => {
  it("restores hero without a token", async () => {
    const store = getStore();
    await store.applyDemoEvent("hero", "b-slips-1430");
    const response = await POST(request({ scenario: "hero" }));
    expect(response.status).toBe(200);
    expect(demoResetResponseSchema.parse(await response.json())).toEqual({ ok: true });
    expect((await store.getSnapshot("hero")).scenario.demo_events[0].applied).toBe(false);
  });

  it.each([{}, { scenario: "real-day" }])("requires the configured token for %o", async body => {
    const reset = vi.spyOn(getStore(), "reset");
    for (const token of [undefined, "incorrect"]) {
      const response = await POST(request(body, token));
      expect(response.status).toBe(401);
      expect(errorResponseSchema.parse(await response.json()).error).toMatchObject({
        code: "UNAUTHORIZED", request_id: response.headers.get("x-request-id"),
      });
    }
    expect(reset).not.toHaveBeenCalled();
  });

  it("rejects privileged reset when no secret is configured and accepts the configured token", async () => {
    vi.stubEnv("DEMO_RESET_TOKEN", undefined);
    expect((await POST(request({}, "privileged-test-reset"))).status).toBe(401);
    vi.stubEnv("DEMO_RESET_TOKEN", "privileged-test-reset");
    const response = await POST(request({}, "privileged-test-reset"));
    expect(response.status).toBe(200);
    expect(demoResetResponseSchema.parse(await response.json())).toEqual({ ok: true });
  });

  it("allows six hero resets per IP in a rolling minute, including across module reloads", async () => {
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const hero = { scenario: "hero" };
    expect((await POST(request(hero))).status).toBe(200);
    now = 10_000;
    for (let i = 0; i < 5; i++) expect((await POST(request(hero))).status).toBe(200);
    vi.resetModules();
    const { POST: reloaded } = await import("@/app/api/demo/reset/route");
    now = 59_999;
    const limited = await reloaded(request(hero));
    expect(limited.status).toBe(429);
    expect(errorResponseSchema.parse(await limited.json()).error).toMatchObject({
      code: "RATE_LIMITED", request_id: limited.headers.get("x-request-id"),
    });
    expect((await reloaded(request(hero, undefined, "192.0.2.11"))).status).toBe(200);
    now = 60_000;
    expect((await reloaded(request(hero))).status).toBe(200);
    expect((await reloaded(request(hero))).status).toBe(429);
  });
});
