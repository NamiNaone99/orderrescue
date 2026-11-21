import "server-only";
import type { InterpreterClient } from "./chain";
import { createOpenAIInterpreter } from "./openai";

type Mode = { interpreter: "offline"; model: null } | { interpreter: "openai"; model: string };

export function getInterpreterMode(): Mode {
  if (process.env.INTERPRETER_MODE === "openai" && process.env.OPENAI_API_KEY?.trim()) {
    return { interpreter: "openai", model: process.env.OPENAI_MODEL?.trim() || "gpt-6-luna" };
  }
  return { interpreter: "offline", model: null };
}

export function getInterpreterRuntime(clients?: readonly InterpreterClient[]): {
  mode: Mode; clients: readonly InterpreterClient[];
} {
  const mode = getInterpreterMode();
  if (mode.interpreter === "offline" || clients?.length === 0) {
    return { mode: { interpreter: "offline", model: null }, clients: [] };
  }
  if (clients) {
    return { mode: { interpreter: "openai", model: clients[0].name.slice("openai:".length) }, clients };
  }
  const fallback = process.env.OPENAI_FALLBACK_MODEL?.trim() || "gpt-6.2-sol";
  return { mode, clients: [createOpenAIInterpreter(mode.model), createOpenAIInterpreter(fallback)] };
}
