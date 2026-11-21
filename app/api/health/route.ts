import { healthRequestSchema, type HealthResponse } from "@/lib/domain/contracts";
import { apiRoute, readQuery } from "@/lib/http";
import { getInterpreterMode } from "@/lib/interpreter/runtime";
import { getStore } from "@/lib/store";
import { StoreError } from "@/lib/store/types";

export function GET(request: Request) {
  return apiRoute(request, async () => {
    readQuery(request, healthRequestSchema);
    const { storage, degraded } = await getStore().health().catch((error: unknown) => {
      if (process.env.STORAGE_MODE === "supabase" && error instanceof StoreError && error.code === "STORAGE_UNAVAILABLE") {
        return { storage: "memory" as const, degraded: true };
      }
      throw error;
    });
    const body: HealthResponse = {
      ok: true, storage, degraded, ...getInterpreterMode(), commit: process.env.VERCEL_GIT_COMMIT_SHA || "dev",
    };
    return { body };
  });
}
