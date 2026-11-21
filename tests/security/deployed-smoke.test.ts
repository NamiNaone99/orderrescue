import { afterEach, expect, it, vi } from "vitest";
import { request } from "@playwright/test";
import { dispatchTarget, targetOrigin, production } from "../../scripts/smoke-target.mjs";
import prepareSmoke from "../../e2e/smoke-setup";

const sha = "a".repeat(40);
const immutable = "https://orderrescue-a123b4567-naminaone99s-projects.vercel.app";
const payload = { url: immutable, git: { ref: "topic", sha }, environment: "preview", state: { type: "success" },
  project: { id: "prj_VS2U4LEB98puXDf7aPTEFI0JPSV7", name: "orderrescue" } };
const event = { repository: { full_name: "NamiNaone99/orderrescue" }, action: "vercel.deployment.success",
  sender: { login: "vercel[bot]", id: 35613825 }, client_payload: payload };
const dispatch = (input: unknown) => dispatchTarget(input, "repository_dispatch", "refs/heads/main", sha);

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

it("accepts a matching Vercel dispatch or the canonical manual target on main", () => {
  expect(dispatch(event)).toEqual({ url: immutable, sha, ref: "preview" });
  expect(dispatchTarget({ ...event, inputs: { url: production } }, "workflow_dispatch", "refs/heads/main", sha))
    .toEqual({ url: production, sha, ref: "main" });
  expect(() => dispatchTarget({ ...event, inputs: { url: immutable } }, "workflow_dispatch", "refs/heads/main", sha)).toThrow();
  expect(() => dispatchTarget(event, "repository_dispatch", "refs/heads/topic", sha)).toThrow();
  expect(() => dispatch({ ...event, sender: { ...event.sender, id: 1 } })).toThrow();
  expect(() => dispatch({ ...event, repository: { full_name: "other/orderrescue" } })).toThrow();
  for (const change of [{ project: { id: "other", name: "orderrescue" } }, { environment: "other" },
    { git: { ref: "main", sha: "../main" } }, { state: { type: "error" } }, { url: production }]) {
    expect(() => dispatch({ ...event, client_payload: { ...payload, ...change } })).toThrow();
  }
});

it("rejects lookalikes, user info, redirects encoded as paths and foreign hosts", () => {
  for (const url of [production + ".example.org", production + "/redirect", production + "?token=sample",
    production + "#fragment", "https://name@orderrescue.vercel.app", "https://orderrescue-other.vercel.app",
    immutable + ":444", "https://orderrescue-xyz-abother.vercel.app", "http://localhost.example.org:3221"]) {
    expect(() => targetOrigin(url, { local: true, deployment: true })).toThrow();
  }
  expect(() => targetOrigin(immutable)).toThrow();
  expect(targetOrigin("http://127.0.0.1:3221", { local: true })).toBe("http://127.0.0.1:3221");
});

it("checks health before each hero write and restores hero during teardown", async () => {
  vi.stubEnv("BASE_URL", production);
  vi.stubEnv("ORDERRESCUE_EXPECTED_SHA", sha);
  vi.stubEnv("ORDERRESCUE_SMOKE_COOKIES", "");
  vi.stubEnv("DEMO_RESET_TOKEN", "local-test-marker");
  vi.stubEnv("VERCEL_AUTOMATION_BYPASS_SECRET", "local-bypass-marker");
  const health = { ok: true, degraded: false, storage: "memory", interpreter: "offline", model: null, commit: sha };
  const get = vi.fn().mockResolvedValue({ status: () => 200, json: async () => health });
  const post = vi.fn().mockResolvedValue({ status: () => 200 });
  const dispose = vi.fn();
  const client = { get, post, dispose, storageState: async () => ({ cookies: [{ domain: ".vercel.app", name: "example", value: "test-cookie" }] }) };
  vi.spyOn(request, "newContext").mockResolvedValue(client as unknown as Awaited<ReturnType<typeof request.newContext>>);
  const cleanup = await prepareSmoke();
  expect(JSON.parse(process.env.ORDERRESCUE_SMOKE_COOKIES ?? "[]")).toEqual([
    { name: "example", value: "test-cookie", domain: "orderrescue.vercel.app" },
  ]);
  expect(process.env.DEMO_RESET_TOKEN).toBeUndefined();
  expect(process.env.VERCEL_AUTOMATION_BYPASS_SECRET).toBeUndefined();
  await cleanup();
  expect(get).toHaveBeenCalledWith("/", { maxRedirects: 0, headers: {
    "x-vercel-protection-bypass": "local-bypass-marker", "x-vercel-set-bypass-cookie": "true",
  } });
  expect(get.mock.calls.filter(([path]) => path === "/api/health")).toHaveLength(3);
  expect(post).toHaveBeenCalledTimes(2);
  expect(post).toHaveBeenCalledWith("/api/demo/reset", { data: { scenario: "hero" }, maxRedirects: 0, headers: { "x-demo-token": "local-test-marker" } });
  expect(dispose).toHaveBeenCalledTimes(1);
  health.commit = "b".repeat(40);
  await expect(prepareSmoke()).rejects.toThrow("expected revision");
  expect(post).toHaveBeenCalledTimes(2);
});
