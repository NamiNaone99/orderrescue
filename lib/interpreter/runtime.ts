import "server-only";
import type { InterpreterClient } from "./chain";

type Mode = { interpreter: "offline"; model: null } | { interpreter: "openai"; model: string };

export function getInterpreterRuntime(clients: readonly InterpreterClient[] = []): {
  mode: Mode; clients: readonly InterpreterClient[];
} {
  if (process.env.INTERPRETER_MODE === "openai" && process.env.OPENAI_API_KEY?.trim() && clients.length) {
    return { mode: { interpreter: "openai", model: clients[0].name.slice("openai:".length) }, clients };
  }
  return { mode: { interpreter: "offline", model: null }, clients: [] };
}

export function getInterpreterMode(): Mode {
  return getInterpreterRuntime().mode;
}
