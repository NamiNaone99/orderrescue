import "server-only";
import type { ReservationRequest } from "@/lib/domain/contracts";
import type { ScenarioId } from "@/lib/domain/types";
import { MemoryStore } from "./memory";
import { SupabaseStore } from "./supabase";
import { StoreError, type SnapshotOptions, type Store } from "./types";

const memory = new MemoryStore();
const database = new SupabaseStore();
const fallbackScenarios = new Set<ScenarioId>();
let healthFailed = false;

function requireDatabase(scenario?: ScenarioId) {
  if (healthFailed || (scenario === undefined ? fallbackScenarios.size > 0 : fallbackScenarios.has(scenario))) {
    throw new StoreError("STORAGE_UNAVAILABLE", "Refresh the database snapshot before writing");
  }
}

const supabase: Store = {
  async getSnapshot(scenarioId: ScenarioId, opts?: SnapshotOptions) {
    try {
      const snapshot = await database.getSnapshot(scenarioId, opts);
      fallbackScenarios.delete(scenarioId);
      healthFailed = false;
      return snapshot;
    } catch (error) {
      if (!(error instanceof StoreError) || error.code !== "STORAGE_UNAVAILABLE") throw error;
      fallbackScenarios.add(scenarioId);
      return memory.getSnapshot(scenarioId, opts);
    }
  },
  async reserve(request: ReservationRequest) {
    requireDatabase(request.scenario);
    return database.reserve(request);
  },
  async applyDemoEvent(scenarioId, eventId) {
    requireDatabase(scenarioId);
    return database.applyDemoEvent(scenarioId, eventId);
  },
  async applyWarehouseReport(scenarioId, key, event) {
    requireDatabase(scenarioId);
    return database.applyWarehouseReport(scenarioId, key, event);
  },
  async reset(scenarioId) {
    requireDatabase(scenarioId);
    return database.reset(scenarioId);
  },
  async health() {
    try {
      await database.health();
      healthFailed = false;
    } catch (error) {
      if (!(error instanceof StoreError) || error.code !== "STORAGE_UNAVAILABLE") throw error;
      healthFailed = true;
    }
    return healthFailed || fallbackScenarios.size > 0
      ? { storage: "memory", degraded: true }
      : { storage: "supabase", degraded: false };
  },
};

export function getStore(): Store {
  return process.env.STORAGE_MODE === "supabase" ? supabase : memory;
}
