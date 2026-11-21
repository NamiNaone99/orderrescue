import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/interpret/route";
import { interpretResponseSchema } from "@/lib/domain/contracts";
import { interpret } from "@/lib/interpreter";
import { createOpenAIInterpreter } from "@/lib/interpreter/openai";
import { buildSystemPrompt } from "@/lib/interpreter/prompt";
import { getInterpreterMode } from "@/lib/interpreter/runtime";
import { heroSampleMessages, heroSnapshot } from "@/lib/scenarios/hero";

const sample = heroSampleMessages[0];
const systemPrompt = buildSystemPrompt(heroSnapshot);
const transport = vi.fn<typeof fetch>();
const primary = "openai:gpt-6-luna";
const secondary = "openai:gpt-6.2-sol";

function providerResponse(content: unknown[], status = "completed") {
  return Response.json({
    object: "response", status, output: [{ type: "message", role: "assistant", content }],
  });
}

function providerText(value: unknown) {
  return providerResponse([{ type: "output_text", text: JSON.stringify(value) }]);
}

function runChain() {
  return interpret(sample.text, heroSnapshot);
}

function logRecords() {
  return vi.mocked(console.info).mock.calls.map(([line]) => JSON.parse(line));
}

beforeEach(() => {
  transport.mockReset();
  vi.stubGlobal("fetch", transport);
  vi.stubEnv("OPENAI_API_KEY", "inert-test-value");
  vi.stubEnv("INTERPRETER_MODE", "openai");
  vi.stubEnv("OPENAI_MODEL", undefined);
  vi.stubEnv("OPENAI_FALLBACK_MODEL", undefined);
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

it("sends only the prompt and message through a strict, stateless Responses call and validates the parsed answer", async () => {
  transport.mockResolvedValueOnce(providerText(sample.expected));
  const result = await runChain();
  expect(result).toMatchObject({
    outcome: "incident", validation: { ok: true, issues: [] }, interpreter: { used: primary },
    incident: { warehouse_id: "A", sku_ids: ["SKU-X"], evidence_quote: sample.expected.evidence_quote },
  });
  expect(transport).toHaveBeenCalledTimes(1);
  const [url, init] = transport.mock.calls[0];
  expect(String(url)).toMatch(/\/v1\/responses$/);
  expect(init?.method).toBe("POST");
  expect(init?.signal).toBeInstanceOf(AbortSignal);
  expect(JSON.parse(String(init?.body))).toEqual({
    instructions: systemPrompt, input: sample.text, model: "gpt-6-luna", store: false,
    reasoning: { effort: "low" }, max_output_tokens: 2048,
    text: { format: { type: "json_schema", name: "incident", strict: true, schema: expect.objectContaining({
      type: "object", additionalProperties: false, required: Object.keys(sample.expected),
    }) } },
  });
  expect(logRecords()).toEqual([{
    model: "gpt-6-luna", latency_ms: expect.any(Number), outcome: "incident", validation_issues: [],
    message_length: sample.text.length,
  }]);
});

it("uses the configured provider from the HTTP route and returns a validated contract response", async () => {
  vi.stubEnv("STORAGE_MODE", "memory");
  transport.mockResolvedValueOnce(providerText(sample.expected));
  const response = await POST(new Request("http://localhost/api/interpret", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ scenario: "hero", message: sample.text }),
  }));
  expect(response.status).toBe(200);
  const result = interpretResponseSchema.parse(await response.json());
  expect(result).toMatchObject({ outcome: "incident", interpreter: { used: primary, attempts: [{ name: primary, ok: true }] } });
  expect(transport).toHaveBeenCalledOnce();
});

it.each([
  ["refusal", () => providerResponse([{ type: "refusal", refusal: "private reason" }])],
  ["incomplete", () => providerResponse([{ type: "output_text", text: "{" }], "incomplete")],
  ["missing_output", () => Response.json({ status: "completed", output: [] })],
  ["invalid_output", () => providerText({ kind: "incident" })],
] as const)("turns a provider %s into a typed failure", async (reason, response) => {
  transport.mockResolvedValueOnce(response());
  const client = createOpenAIInterpreter("gpt-6-luna");
  await expect(client.run({ systemPrompt, message: sample.text, signal: new AbortController().signal }))
    .resolves.toEqual({ status: reason });
  expect(transport).toHaveBeenCalledTimes(1);
});

it("uses the configured fallback when the primary evidence fails V5 and records sanitized validation issues", async () => {
  vi.stubEnv("OPENAI_MODEL", "configured-primary");
  vi.stubEnv("OPENAI_FALLBACK_MODEL", "configured-fallback");
  transport.mockResolvedValueOnce(providerText({ ...sample.expected, evidence_quote: "invented evidence" }))
    .mockResolvedValueOnce(providerText(sample.expected));
  const result = await runChain();
  expect(getInterpreterMode()).toEqual({ interpreter: "openai", model: "configured-primary" });
  expect(result.interpreter).toMatchObject({
    used: "openai:configured-fallback", attempts: [
      { name: "openai:configured-primary", ok: false, reason: "V5" },
      { name: "openai:configured-fallback", ok: true },
    ],
  });
  expect(transport.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).model))
    .toEqual(["configured-primary", "configured-fallback"]);
  expect(logRecords()).toEqual([
    { model: "configured-primary", latency_ms: expect.any(Number), outcome: "clarification", validation_issues: ["V5"], message_length: sample.text.length },
    { model: "configured-fallback", latency_ms: expect.any(Number), outcome: "incident", validation_issues: [], message_length: sample.text.length },
  ]);
});

it("makes no SDK retries on provider errors and keeps upstream details out of logs and attempts", async () => {
  const privateDetail = "provider diagnostic containing private text";
  transport.mockImplementation(async () => Response.json({ error: { message: privateDetail } }, { status: 500 }));
  const result = await runChain();
  expect(result.interpreter).toMatchObject({
    used: "offline", attempts: [
      { name: primary, ok: false, reason: "error" },
      { name: secondary, ok: false, reason: "error" },
      { name: "offline", ok: true },
    ],
  });
  expect(transport).toHaveBeenCalledTimes(2);
  const log = JSON.stringify(logRecords());
  for (const text of [privateDetail, sample.text, "inert-test-value", systemPrompt]) expect(log).not.toContain(text);
  expect(JSON.stringify(result)).not.toContain(privateDetail);
});

it("aborts both SDK transports and answers offline after eighteen seconds", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  transport.mockImplementation((_, init) => new Promise((_, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Timed out", "AbortError")), { once: true });
  }));
  const pending = runChain();
  await vi.advanceTimersByTimeAsync(18_000);
  const result = await pending;
  expect(transport).toHaveBeenCalledTimes(2);
  expect(transport.mock.calls.every(([, init]) => init?.signal?.aborted)).toBe(true);
  expect(result.interpreter).toEqual({
    used: "offline", latency_ms: 18_000, rate_limited: false, attempts: [
      { name: primary, ok: false, reason: "timeout" },
      { name: secondary, ok: false, reason: "timeout" },
      { name: "offline", ok: true },
    ],
  });
});

it.each([["offline", "inert-test-value"], ["openai", " "]])("skips transport for mode %s and a disabled configuration", async (mode, key) => {
  vi.stubEnv("INTERPRETER_MODE", mode);
  vi.stubEnv("OPENAI_API_KEY", key);
  expect(getInterpreterMode()).toEqual({ interpreter: "offline", model: null });
  expect((await runChain()).interpreter.used).toBe("offline");
  expect(transport).not.toHaveBeenCalled();
});
