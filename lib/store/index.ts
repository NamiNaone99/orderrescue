import "server-only";
import { MemoryStore } from "./memory";
import type { Store } from "./types";

const memory = new MemoryStore();
const stores = new Map<string, Store>([["memory", memory]]);

export function getStore(): Store {
  return stores.get(process.env.STORAGE_MODE ?? "memory") ?? memory;
}
