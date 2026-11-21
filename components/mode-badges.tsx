"use client";

import { useEffect, useState } from "react";
import { Cpu, Database, TriangleAlert } from "lucide-react";
import type { HealthResponse } from "@/lib/domain/contracts";
import { api } from "@/lib/client/api";
import { copy } from "@/lib/copy";

export function ModeBadges() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    async function readHealth() {
      try {
        const result = await api.health(controller.signal);
        if (!controller.signal.aborted) setHealth(result);
      } catch {
        // A missing or unreachable health route leaves the service modes unknown.
      }
    }
    void readHealth();
    return () => controller.abort();
  }, []);
  return <div className="mode-badges" aria-label={copy.services.th}>
    <span className="mode-badge"><Cpu size={16} aria-hidden /> <span lang="en">AI: {health ? health.model ?? "offline" : "—"}</span></span>
    <span className={health?.degraded ? "mode-badge degraded" : "mode-badge"} title={health?.degraded ? copy.degraded.th : undefined}>
      {health?.degraded ? <TriangleAlert size={16} aria-hidden /> : <Database size={16} aria-hidden />}
      <span lang="en">DB: {health ? health.storage === "supabase" ? "Supabase" : "memory" : "—"}</span>
    </span>
    {!health && <span className="sr-only">{copy.unavailable.th}</span>}
    {health?.degraded && <span className="degraded-note" role="status">{copy.degraded.th}</span>}
  </div>;
}
