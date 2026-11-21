import "server-only";
import type { InterpretResponse } from "@/lib/domain/contracts";
import type { Snapshot } from "@/lib/domain/types";
import { offlineInterpret } from "./offline";
import { buildSystemPrompt } from "./prompt";
import { checkMessage, InvalidOutputError, validate } from "./validate";

export type InterpreterResult =
  | { status: "parsed"; output: unknown }
  | { status: "refusal" | "incomplete" | "missing_output" | "timeout" | "authentication" | "invalid_output" | "error" };

export interface InterpreterClient {
  name: `openai:${string}`;
  run(request: { systemPrompt: string; message: string; signal: AbortSignal }): Promise<InterpreterResult>;
}

export type InterpreterOptions = { clients?: readonly InterpreterClient[]; allowAttempt?: () => boolean };

type Attempt = InterpretResponse["interpreter"]["attempts"][number];
export const INTERPRETER_TIMEOUT_MS = 9_000;

async function runClient(client: InterpreterClient, systemPrompt: string, message: string) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new DOMException("Interpreter deadline exceeded", "TimeoutError");
      reject(error);
      controller.abort(error);
    }, INTERPRETER_TIMEOUT_MS);
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
  deps: InterpreterOptions = {},
): Promise<InterpretResponse> {
  const started = performance.now();
  const checkedMessage = checkMessage(message);
  const attempts: Attempt[] = [];
  let rateLimited = false;

  function finish(answer: ReturnType<typeof validate>, used: string): InterpretResponse {
    const [issue] = answer.validation.issues;
    attempts.push(issue ? { name: used, ok: false, reason: issue } : { name: used, ok: true });
    return {
      ...answer,
      interpreter: { used, attempts, latency_ms: Math.round(performance.now() - started), rate_limited: rateLimited },
    };
  }

  const clients = deps.clients?.slice(0, 2) ?? [];
  if (clients.length) {
    const systemPrompt = buildSystemPrompt(snapshot);
    for (const client of clients) {
      if (deps.allowAttempt && !deps.allowAttempt()) {
        rateLimited = true;
        break;
      }
      const attemptStart = performance.now();
      function logCall(outcome: string, issues: string[] = []) {
        console.info(JSON.stringify({
          model: client.name.slice("openai:".length),
          latency_ms: Math.round(performance.now() - attemptStart),
          outcome, validation_issues: issues, message_length: checkedMessage.length,
        }));
      }
      try {
        const response = await runClient(client, systemPrompt, checkedMessage);
        if (response.status !== "parsed") {
          logCall(response.status);
          attempts.push({ name: client.name, ok: false, reason: response.status });
          continue;
        }
        const answer = validate(response.output, message, snapshot);
        logCall(answer.outcome, answer.validation.issues);
        if (answer.validation.issues.includes("V5")) {
          attempts.push({ name: client.name, ok: false, reason: "V5" });
          continue;
        }
        return finish(answer, client.name);
      } catch (error) {
        const reason = failureReason(error);
        logCall(reason);
        attempts.push({ name: client.name, ok: false, reason });
      }
    }
  }

  return finish(validate(offlineInterpret(message, snapshot), message, snapshot), "offline");
}
