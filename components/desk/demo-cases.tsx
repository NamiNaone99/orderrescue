"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Layers3 } from "lucide-react";
import { caseHref, demoCases, findDemoCase, type DemoCase } from "@/lib/client/demo-cases";
import type { useDesk } from "@/lib/client/use-desk";
import { caseCopy as c, copy } from "@/lib/copy";
import { formatThb } from "@/lib/domain/money";
import "./demo-cases.css";

function openInsights(id: string) {
  const panel = document.getElementById(id);
  if (panel instanceof HTMLDetailsElement) {
    panel.open = true;
    panel.querySelector("summary")?.focus();
  }
}

export function DemoCases({ selected, desk, sample, reading, booked, run, prepare }: {
  selected: DemoCase | undefined;
  desk: ReturnType<typeof useDesk>;
  sample: string | undefined;
  reading: boolean;
  booked: boolean;
  run: (sample: string) => void;
  prepare: (type: "delay" | "stock_found") => void;
}) {
  const router = useRouter();
  const { s } = desk;
  const active = selected && c.cases[selected.id];
  const matches = !!sample && s.evidenceMessage === sample && s.interpretation?.outcome === "incident";
  const plan = matches && s.plannedInput && !s.stale ? s.plan : null;
  const disabled = !!s.busy || !!s.confirmation || reading;
  const stockLoaded = !!s.stock && s.stock.scenario.id === selected?.scenario;
  const status = booked ? copy.booked : s.stale ? copy.stockChanged : undefined;
  function action() {
    if (!selected || !sample || booked) return null;
    if (s.stale) return { label: copy.replan, perform: desk.replan };
    if (!matches) return { label: c.launch, perform: () => run(sample) };
    const skus = s.interpretation?.incident?.sku_ids ?? [];
    if (!plan && skus.length > 1) return { label: c.chooseSku, perform: () => document.querySelector<HTMLInputElement>('input[name="incident-sku"]')?.focus() };
    if (!plan) return { label: c.launch, perform: () => run(sample) };
    switch (selected.id) {
      case "flood": return { label: c.why, perform: () => openInsights("desk-why") };
      case "campaign": return { label: c.frontier, perform: () => openInsights("desk-frontier") };
      case "shock": {
        const next = skus.find(id => id !== s.sku);
        return next ? { label: c.switchSku, perform: () => desk.select(next, s.budget) } : null;
      }
      case "carrier": return { label: c.delay, perform: () => prepare("delay") };
      case "shortage": return { label: c.found, perform: () => prepare("stock_found") };
    }
  }
  const next = action();
  return <section className="demo-cases" aria-labelledby="demo-case-heading" data-case={selected?.id}>
    <div className="case-picker">
      <div className="case-label"><Layers3 aria-hidden /><div><label id="demo-case-heading" htmlFor="demo-case">{c.title.th}</label><small lang="en">{c.title.en}</small></div></div>
      <select id="demo-case" value={selected?.id ?? ""} disabled={!!s.confirmation || reading || s.busy === "book"} onChange={event => {
        const item = findDemoCase(event.target.value);
        router.push(item ? caseHref(item) : "/", { scroll: false });
      }}>
        <option value="">{c.choose.th}</option>
        {demoCases.map(item => <option key={item.id} value={item.id}>{c.cases[item.id].title.th}</option>)}
      </select>
    </div>
    {active && <div className="case-brief">
      <div className="case-story"><h2>{active.title.th} <small lang="en">{active.title.en}</small></h2>
        <p>{active.context.th}</p><p className="case-scope">{active.scope.th}</p>
      </div>
      <div className="case-example">
        <span>{c.draft.th}</span>
        {sample ? <q>{sample}</q> : <p>{c.sampleUnavailable.th}</p>}
        {plan && <p role="status" className="case-result"><strong>{c.result.th}</strong> · {copy.firstCome.th} {plan.first_come.on_time}/{plan.affected.length} · {copy.joint.th} {plan.joint.on_time}/{plan.affected.length} · {formatThb(plan.joint.extra_cost_thb)}</p>}
        {status && <p role="status">{status.th}</p>}
        {next && <button id="case-action" className="outline-action" type="button" disabled={disabled || !stockLoaded} onClick={next.perform}>{next.label.th}<ArrowRight aria-hidden /></button>}
      </div>
    </div>}
  </section>;
}
