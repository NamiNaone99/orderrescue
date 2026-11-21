"use client";

import { createContext, Suspense, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Scenario } from "@/lib/domain/types";
import { Header } from "./header";
import { ServiceHealthProvider } from "./mode-badges";

export type ShellScenario = Pick<Scenario, "id" | "name_th" | "name_en" | "kind" | "now_at" | "default_sku_id" | "sample_messages" | "default_budget_thb" | "demo_events">;

const ActiveScenario = createContext<ShellScenario | null>(null);

const DeskQuery = createContext("");
export const useDeskQuery = () => useContext(DeskQuery);

export function useScenario(): ShellScenario {
  const scenario = useContext(ActiveScenario);
  if (!scenario) throw new Error("Missing scenario context");
  return scenario;
}

type ShellProps = { scenarios: ShellScenario[]; children: ReactNode };

function Shell({ scenarios, scenario, query, children }: ShellProps & { scenario: ShellScenario; query: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [revision, setRevision] = useState(0);
  function href(path: string, id = scenario.id) {
    const params = new URLSearchParams(query);
    for (const key of ["tour", "tourRun", "notes", "receipt"]) params.delete(key);
    params.set("scenario", id);
    return path + "?" + params.toString();
  }
  return (
    <DeskQuery.Provider value={query}><ActiveScenario.Provider value={scenario}>
      <Header scenarios={scenarios} scenario={scenario} pathname={pathname} href={href}
        onSelect={(id) => router.push(href(pathname, id), { scroll: false })}
        onReset={() => {
          setRevision(value => value + 1);
          if (pathname !== "/") router.push(href("/"));
          router.refresh();
        }} />
      <main id="desk-main" className="workspace" key={scenario.id + revision}>{children}</main>
    </ActiveScenario.Provider></DeskQuery.Provider>
  );
}

function QueryObserver({ onChange }: { onChange: (query: string) => void }) {
  const query = useSearchParams().toString();
  useEffect(() => { onChange(query); }, [query, onChange]);
  return null;
}

export function ScenarioShell({ scenarios, children }: ShellProps) {
  const [query, setQuery] = useState("");
  const params = new URLSearchParams(query);
  const pathname = usePathname();
  const id = pathname === "/" && params.get("tour") === "1" ? "hero" : params.get("scenario") ?? "hero";
  const scenario = scenarios.find(item => item.id === id) ?? scenarios.find(item => item.id === "hero") ?? scenarios[0];
  return <ServiceHealthProvider>
    <Suspense fallback={null}><QueryObserver onChange={setQuery} /></Suspense>
    <Shell scenarios={scenarios} scenario={scenario} query={query}>{children}</Shell>
  </ServiceHealthProvider>;
}
