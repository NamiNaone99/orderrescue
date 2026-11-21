"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Cpu, Database, TriangleAlert } from "lucide-react";
import type { HealthResponse } from "@/lib/domain/contracts";
import { api } from "@/lib/client/api";
import { copy } from "@/lib/copy";

const ServiceHealth = createContext<HealthResponse | null>(null);

export function useServiceHealth() { return useContext(ServiceHealth); }

export function ServiceHealthProvider({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  useEffect(() => {
    let current: AbortController | undefined;
    async function readHealth() {
      current?.abort();
      const controller = new AbortController();
      current = controller;
      try {
        const result = await api.health(controller.signal);
        if (!controller.signal.aborted) setHealth(result);
      } catch {
        // A missing or unreachable health route leaves the service modes unknown.
      }
    }
    void readHealth();
    window.addEventListener("focus", readHealth);
    return () => { window.removeEventListener("focus", readHealth); current?.abort(); };
  }, []);
  return <ServiceHealth.Provider value={health}>{children}</ServiceHealth.Provider>;
}

export function ModeBadges() {
  const health = useServiceHealth();
  return <div className="mode-badges" aria-label={copy.services.th}>
    <span className="mode-badge"><Cpu size={16} aria-hidden /> <span lang="en">AI: {health ? health.model ?? "offline" : "—"}</span></span>
    <span className={health?.degraded ? "mode-badge degraded" : "mode-badge"} title={health?.degraded ? copy.degraded.th : undefined}>
      {health?.degraded ? <TriangleAlert size={16} aria-hidden /> : <Database size={16} aria-hidden />}
      <span lang="en">DB: {health ? health.storage === "supabase" ? "Supabase" : "memory" : "—"}</span>
    </span>
    {!health && <span className="sr-only">{copy.unavailable.th}</span>}
  </div>;
}
