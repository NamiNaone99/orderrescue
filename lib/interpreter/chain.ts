import "server-only";
import type { InterpretResponse } from "@/lib/domain/contracts";
import type { Snapshot } from "@/lib/domain/types";
import { offlineInterpret } from "./offline";
import { buildSystemPrompt } from "./prompt";
import { checkMessage, InvalidOutputError, validate } from "./validate";

export type InterpreterResult =
  | { status: "parsed"; output: unknown }
  | { status: "refusal" | "incomplete" | "missing_output" };

export interface InterpreterClient {
  name: `openai:${string}`;
  run(request: { systemPrompt: string; message: string; signal: AbortSignal }): Promise<InterpreterResult>;
}

type Attempt = InterpretResponse["interpreter"]["attempts"][number];
const timeoutMs = 9_000;

async function runClient(client: InterpreterClient, systemPrompt: string, message: string) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new DOMException("Interpreter deadline exceeded", "TimeoutError");
      reject(error);
      controller.abort(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([client.run({ systemPrompt, message, signal: controller.signal }), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

function failureReason(error: unknown) {
  if (error instanceof InvalidOutputError) return "invalid_output";
  if (error instanceof Error && ["TimeoutError", "APIConnectionTimeoutError", "AbortError"].includes(error.name)) {
    return "timeout";
  }
  return "error";
}

export async function interpret(
  message: string,
  snapshot: Snapshot,
  deps: { clients?: readonly InterpreterClient[] } = {},
): Promise<InterpretResponse> {
  const started = performance.now();
  const checkedMessage = checkMessage(message);
  const attempts: Attempt[] = [];

  function finish(answer: ReturnType<typeof validate>, used: string): InterpretResponse {
    const [issue] = answer.validation.issues;
    attempts.push(issue ? { name: used, ok: false, reason: issue } : { name: used, ok: true });
    return {
      ...answer,
      interpreter: { used, attempts, latency_ms: Math.round(performance.now() - started), rate_limited: false },
    };
  }

  const clients = deps.clients?.slice(0, 2) ?? [];
  if (clients.length) {
    const systemPrompt = buildSystemPrompt(snapshot);
    for (const client of clients) {
      try {
        const response = await runClient(client, systemPrompt, checkedMessage);
        if (response.status !== "parsed") {
          attempts.push({ name: client.name, ok: false, reason: response.status });
          continue;
        }
        const answer = validate(response.output, message, snapshot);
        if (answer.validation.issues.includes("V5")) {
          attempts.push({ name: client.name, ok: false, reason: "V5" });
          continue;
        }
        return finish(answer, client.name);
      } catch (error) {
        attempts.push({ name: client.name, ok: false, reason: failureReason(error) });
      }
    }
  }

  return finish(validate(offlineInterpret(message, snapshot), message, snapshot), "offline");
}
