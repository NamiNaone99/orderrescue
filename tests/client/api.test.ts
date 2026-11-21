import { afterEach, expect, it, vi } from "vitest";
import { api } from "@/lib/client/api";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("preserves the request ID and handles a non-JSON firewall 429", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Try later", { status: 429, headers: { "x-request-id": "edge-request" } })));
  await expect(api.health()).rejects.toMatchObject({ code: "RATE_LIMITED", requestId: "edge-request", status: 429 });
});

it("rejects malformed success and preserves a typed error response", async () => {
  const id = "00000000-0000-4000-8000-000000000001";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ ok: true }))
    .mockResolvedValueOnce(Response.json({ error: { code: "UNAUTHORIZED", message: "Bad token", request_id: id } }, { status: 401 })));
  await expect(api.health()).rejects.toMatchObject({ code: "INTERNAL" });
  await expect(api.reset({})).rejects.toMatchObject({ code: "UNAUTHORIZED", requestId: id });
});

it("gives interpretation 30 seconds and other routes 10 seconds and exposes a typed network failure", async () => {
  const timeout = vi.spyOn(AbortSignal, "timeout");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Timed out", "TimeoutError")));
  await expect(api.interpret({ scenario: "hero", message: "hello" })).rejects.toMatchObject({ code: "INTERNAL", status: 0 });
  await expect(api.state({ scenario: "hero" })).rejects.toMatchObject({ code: "INTERNAL", status: 0 });
  expect(timeout.mock.calls).toEqual([[30_000], [10_000]]);
});
