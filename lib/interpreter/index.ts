import "server-only";
import type { Snapshot } from "@/lib/domain/types";
import { interpret as runChain, type InterpreterClient, type InterpreterOptions } from "./chain";
import { getInterpreterRuntime } from "./runtime";

export type { InterpreterClient };
export { InvalidMessageError } from "./validate";

export function interpret(
  message: string,
  snapshot: Snapshot,
  options: InterpreterOptions = {},
) {
  return runChain(message, snapshot, {
    ...options, clients: options.clients ?? getInterpreterRuntime().clients,
  });
}
