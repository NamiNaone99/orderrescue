import "server-only";
import { MemoryStore } from "./memory";
import { StoreError, type Store } from "./types";

const memory = new MemoryStore();

async function refuseWrite(): Promise<never> {
  throw new StoreError("STORAGE_UNAVAILABLE", "Configured storage is unavailable");
}

// Keep reads available without accepting confirmations into a different store.
const unavailableSupabase: Store = {
  getSnapshot: (scenario, opts) => memory.getSnapshot(scenario, opts),
  health: async () => ({ storage: "memory", degraded: true }),
  reserve: refuseWrite,
  applyDemoEvent: refuseWrite,
  reset: refuseWrite,
};

export function getStore(): Store {
  return process.env.STORAGE_MODE === "supabase" ? unavailableSupabase : memory;
}
