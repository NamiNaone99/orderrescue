"use client";

import { useEffect, useState } from "react";
import { Cpu, Database, TriangleAlert } from "lucide-react";
import { healthResponseSchema, type HealthResponse } from "@/lib/domain/contracts";
import { copy } from "@/lib/copy";

export function ModeBadges() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    async function readHealth() {
      try {
        const response = await fetch("/api/health", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) return;
        const checked = healthResponseSchema.safeParse(await response.json());
        if (!controller.signal.aborted && checked.success) setHealth(checked.data);
      } catch {
        // A missing or unreachable health route leaves the service modes unknown.
      } finally {
        clearTimeout(timer);
      }
    }
    void readHealth();
    return () => { clearTimeout(timer); controller.abort(); };
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
