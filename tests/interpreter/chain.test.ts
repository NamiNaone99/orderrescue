import { expect, it, vi } from "vitest";
import { interpretResponseSchema } from "@/lib/domain/contracts";
import { interpret, type InterpreterClient, type InterpreterResult } from "@/lib/interpreter/chain";
import { heroIncident, heroSampleMessages, heroSnapshot } from "@/lib/scenarios/hero";

const [incident, clarification, ignore] = heroSampleMessages;
const primary = "openai:gpt-6-luna";
const fallback = "openai:gpt-6.2-sol";

function client(name: InterpreterClient["name"], run: InterpreterClient["run"]) {
  return { name, run: vi.fn(run) };
}

function parsed(output: unknown): InterpreterResult {
  return { status: "parsed", output };
}

it("answers offline by default and includes the interpreter and latency", async () => {
  const answer = await interpret(incident.text, heroSnapshot);
  expect(interpretResponseSchema.parse(answer)).toEqual(answer);
  expect(answer).toMatchObject({
    outcome: "incident",
    incident: {
      warehouse_id: "A", sku_ids: ["SKU-X"], window_start: heroIncident.window_start,
      window_end: heroIncident.window_end, evidence_quote: incident.expected.evidence_quote,
    },
    interpreter: { used: "offline", attempts: [{ name: "offline", ok: true }], rate_limited: false },
  });
  expect(answer.interpreter.latency_ms).toBeGreaterThanOrEqual(0);
});

it("passes only the system prompt, checked message and signal to the primary", async () => {
  const first = client(primary, async () => parsed(incident.expected));
  const second = client(fallback, async () => parsed(ignore.expected));
  const answer = await interpret(` ${incident.text} `, heroSnapshot, { clients: [first, second] });
  expect(first.run).toHaveBeenCalledExactlyOnceWith({
    systemPrompt: expect.any(String), message: incident.text, signal: expect.any(AbortSignal),
  });
  expect(second.run).not.toHaveBeenCalled();
  expect(answer.interpreter).toMatchObject({ used: primary, attempts: [{ name: primary, ok: true }] });
});

it.each([
  ["refusal", { status: "refusal" }],
  ["incomplete", { status: "incomplete" }],
  ["missing_output", { status: "missing_output" }],
  ["invalid_output", parsed({ kind: "incident" })],
  ["V5", parsed({ ...incident.expected, evidence_quote: "invented quote" })],
] as const)("tries the fallback on %s", async (reason, failed) => {
  const first = client(primary, async () => failed);
  const second = client(fallback, async () => parsed(incident.expected));
  const answer = await interpret(incident.text, heroSnapshot, { clients: [first, second] });
  expect(answer.outcome).toBe("incident");
  expect(answer.interpreter).toMatchObject({
    used: fallback, attempts: [{ name: primary, ok: false, reason }, { name: fallback, ok: true }],
  });
  expect(first.run).toHaveBeenCalledTimes(1);
  expect(second.run).toHaveBeenCalledTimes(1);
});

it("uses offline after two errors and keeps raw provider error details private", async () => {
  const secretDetail = "private upstream diagnostic";
  const first = client(primary, async () => { throw new Error(secretDetail); });
  const second = client(fallback, async () => { throw new DOMException(secretDetail, "TimeoutError"); });
  const extra = client("openai:unused", async () => parsed(ignore.expected));
  const answer = await interpret(incident.text, heroSnapshot, { clients: [first, second, extra] });
  expect(answer.outcome).toBe("incident");
  expect(answer.interpreter).toMatchObject({
    used: "offline", attempts: [
      { name: primary, ok: false, reason: "error" },
      { name: fallback, ok: false, reason: "timeout" },
      { name: "offline", ok: true },
    ],
  });
  expect(JSON.stringify(answer)).not.toContain(secretDetail);
  expect(extra.run).not.toHaveBeenCalled();
});

it("uses the fallback answer when the primary throws", async () => {
  const first = client(primary, async () => { throw new Error("provider unavailable"); });
  const second = client(fallback, async () => parsed(incident.expected));
  const answer = await interpret(incident.text, heroSnapshot, { clients: [first, second] });
  expect(answer).toMatchObject({
    outcome: "incident", interpreter: {
      used: fallback, attempts: [{ name: primary, ok: false, reason: "error" }, { name: fallback, ok: true }],
    },
  });
});

it.each([
  ["V1", { warehouse: null }, "warehouse"],
  ["V2", { warehouse: "unknown" }, "warehouse"],
  ["V3", { skus: ["unknown"] }, "sku"],
  ["V4", { window_end: "12:00" }, "time"],
] as const)("returns a clarification immediately for %s", async (rule, change, about) => {
  const first = client(primary, async () => parsed({ ...incident.expected, ...change }));
  const second = client(fallback, async () => parsed(incident.expected));
  const answer = await interpret(incident.text, heroSnapshot, { clients: [first, second] });
  expect(answer).toMatchObject({
    outcome: "clarification", incident: null, clarification: { about },
    validation: { ok: false, issues: [rule] },
    interpreter: { used: primary, attempts: [{ name: primary, ok: false, reason: rule }] },
  });
  expect(second.run).not.toHaveBeenCalled();
});

it.each([clarification, ignore])("accepts a validated $expected.kind as a final answer", async sample => {
  const first = client(primary, async () => parsed(sample.expected));
  const second = client(fallback, async () => parsed(incident.expected));
  const answer = await interpret(sample.text, heroSnapshot, { clients: [first, second] });
  expect(answer).toMatchObject({
    outcome: sample.expected.kind, incident: null, validation: { ok: true, issues: [] },
    interpreter: { used: primary, attempts: [{ name: primary, ok: true }] },
  });
  expect(second.run).not.toHaveBeenCalled();
});

it("checks V6 before invoking any client", async () => {
  const first = client(primary, async () => parsed(incident.expected));
  for (const message of [" \t ", "x".repeat(501)]) {
    await expect(interpret(message, heroSnapshot, { clients: [first] })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  }
  expect(first.run).not.toHaveBeenCalled();
});

it("aborts each unresponsive client at nine seconds and returns offline at eighteen", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  try {
    const neverFinishes: InterpreterClient["run"] = () => new Promise(() => {});
    const first = client(primary, neverFinishes);
    const second = client(fallback, neverFinishes);
    const pending = interpret(incident.text, heroSnapshot, { clients: [first, second] });

    await vi.advanceTimersByTimeAsync(8_999);
    expect(first.run.mock.calls[0][0].signal.aborted).toBe(false);
    expect(second.run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(first.run.mock.calls[0][0].signal.aborted).toBe(true);
    expect(second.run.mock.calls[0][0].signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(9_000);
    expect(second.run.mock.calls[0][0].signal.aborted).toBe(true);
    const answer = await pending;
    expect(answer.interpreter).toEqual({
      used: "offline", latency_ms: 18_000, rate_limited: false,
      attempts: [
        { name: primary, ok: false, reason: "timeout" },
        { name: fallback, ok: false, reason: "timeout" },
        { name: "offline", ok: true },
      ],
    });
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});
