"use client";

import { useEffect, useRef, useState } from "react";
import { ChartNoAxesCombined, Check, ChevronDown, ListTree } from "lucide-react";
import { api } from "@/lib/client/api";
import { type useDesk, validBudget } from "@/lib/client/use-desk";
import { attainedSteps, effectiveWindowEnd, frontierBudgets, insightSources, observedBudget, optionText,
  orderExplanations, type BudgetPoint } from "@/lib/client/plan-insights";
import { copy, insightCopy as c, type CopyEntry } from "@/lib/copy";
import type { PlanRequest, PlanResponse, StateResponse } from "@/lib/domain/contracts";
import { formatThb } from "@/lib/domain/money";
import { formatBangkokTime } from "@/lib/domain/time";
import "./plan-insights.css";

type Props = {
  plan: PlanResponse; stock: StateResponse; input: PlanRequest; budget: string;
  locked: boolean; changeBudget: (value: string) => void;
};

function Summary({ label, chart = false }: { label: CopyEntry; chart?: boolean }) {
  const Icon = chart ? ChartNoAxesCombined : ListTree;
  return <summary><Icon aria-hidden /><span>{label.th}<small lang="en">{label.en}</small></span><ChevronDown aria-hidden /></summary>;
}

function Why({ plan, stock, input }: Pick<Props, "plan" | "stock" | "input">) {
  const orders = orderExplanations(plan, stock, input.incident);
  if (!orders.length) return <p>{c.noOrders.th}</p>;
  return <><p className="insight-caption">{c.allocation.th}</p>
    {orders.map(({ order, chosen, options }) => <section className="insight-order" key={order.order_id} aria-label={"#" + order.order_id}>
      <header><h3>#{order.order_id}</h3><span>{order.qty} {c.units.th} · {c.by.th} {formatBangkokTime(order.deadline_at)}</span></header>
      {!chosen && <p className="insight-human">{c.manual.th}</p>}
      <ul>{options.map(option => <li key={option.warehouse} data-reason={option.reason}>
        <strong>{copy.warehouse.th} {option.warehouse}</strong>
        <span>{option.reason === "chosen" && <Check aria-hidden />}{optionText(option)}</span>
        <span>{option.cost === null ? "—" : "฿" + option.cost.toLocaleString("th-TH")}</span>
      </li>)}</ul>
    </section>)}</>;
}

function BudgetChart({ points, current, total, exact, max }: {
  points: BudgetPoint[]; current: BudgetPoint; total: number; exact: boolean; max: number;
}) {
  const steps = attainedSteps(points);
  const left = 25, right = 309, top = 12, bottom = 106;
  const x = (value: number) => left + (right - left) * value / max;
  const y = (count: number) => bottom - (bottom - top) * count / Math.max(1, total);
  const path = steps.map((point, i) => i ? `H ${x(point.budget)} V ${y(point.onTime)}` : `M ${x(point.budget)} ${y(point.onTime)}`).join(" ") + " H " + right;
  const description = c.budgetValue.th.replace("{budget}", formatThb(current.budget)).replace("{count}", String(current.onTime));
  const ticks = [...new Set([0, Math.ceil(total / 2), total])];
  const milestones = exact && max < 10000 ? steps.filter((p, i) => i > 0 &&
    x(p.budget) - x(steps[i - 1].budget) > 28 && right - x(p.budget) > 28) : [];
  return <div className="insight-chart">
    <div className="insight-axis">{c.count.th}<span>{c.budgetAxis.th}</span></div>
    <svg viewBox="0 0 320 134" role="img" aria-label={c.frontier.th + " · " + description}>
      {ticks.map(tick => <g key={tick}><line className="chart-grid" x1={left} x2={right} y1={y(tick)} y2={y(tick)} />
        <text x={left - 8} y={y(tick) + 4} textAnchor="end">{tick}</text></g>)}
      <path className={exact ? "frontier-path" : "frontier-path sampled"} d={path} />
      {points.map(point => <circle className="frontier-dot" key={point.budget} cx={x(point.budget)} cy={y(point.onTime)} r="2.7" />)}
      <line className="current-line" x1={x(current.budget)} x2={x(current.budget)} y1={top} y2={bottom} />
      <circle className="current-dot" cx={x(current.budget)} cy={y(current.onTime)} r="4.5" />
      {milestones.map(p => <text key={p.budget} x={x(p.budget)} y="127" textAnchor="middle">{p.budget}</text>)}
      <text x={left} y="127">0</text><text x={right} y="127" textAnchor="end">{max.toLocaleString("th-TH")}</text>
    </svg>
    <p className="insight-caption">{exact ? c.exact.th : c.sampled.th}</p>
    <ul className="frontier-values">{(exact ? steps : points).map(point => <li key={point.budget}>
      <strong>{formatThb(point.budget)}</strong> · {point.onTime}/{total}</li>)}</ul>
  </div>;
}

export function PlanInsights({ desk, locked }: { desk: ReturnType<typeof useDesk>; locked: boolean }) {
  const { s, incident } = desk;
  if (!s.plan || !s.baseline || !incident || s.stale || !validBudget(s.budget) ||
    s.baseline.state_version !== s.plan.state_version || s.baseline.skus[0]?.id !== s.sku) return null;
  const input = s.plannedInput ?? {
    scenario: s.baseline.scenario.id, budget_thb: s.plan.budget_thb,
    incident: { warehouse_id: incident.warehouse_id, sku_id: s.sku, window_start: incident.window_start, window_end: incident.window_end },
  };
  // Keep checked budgets while editing THB. Discard them on a different incident or a refreshed stock version.
  const key = JSON.stringify([input.scenario, input.incident, effectiveWindowEnd(s.plan, input.incident), s.plan.state_version]);
  return <Panels key={key} plan={s.plan} stock={s.baseline} input={input} budget={s.budget} locked={locked}
    changeBudget={v => desk.select(s.sku, v, true)} />;
}

function Panels({ plan, stock, input, budget, locked, changeBudget }: Props) {
  const [whyOpen, setWhyOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "failed" | "changed">("idle");
  const [samples, setSamples] = useState<{ points: BudgetPoint[]; exact: boolean } | null>(null);
  const checked = useRef(new Map<number, BudgetPoint>());
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  async function compare() {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setStatus("loading");
    const rows = insightSources(plan, stock, input.incident);
    const { budgets, exact } = frontierBudgets(plan, rows);
    const points: BudgetPoint[] = [];
    try {
      for (const amount of budgets) {
        let point = checked.current.get(amount);
        if (!point) {
          const result = amount === plan.budget_thb ? plan : await api.plan({ ...input, budget_thb: amount }, controller.signal);
          if (controller.signal.aborted) return;
          if (result.state_version !== plan.state_version ||
            effectiveWindowEnd(result, input.incident) !== effectiveWindowEnd(plan, input.incident)) {
            checked.current.clear();
            setSamples(null);
            setStatus("changed");
            return;
          }
          point = observedBudget(result);
          checked.current.set(amount, point);
        }
        points.push(point);
      }
      setSamples({ points, exact: exact && points.every(point => point.proven) });
      setStatus("ready");
    } catch {
      if (!controller.signal.aborted) setStatus("failed");
    }
  }

  const current = observedBudget(plan);
  const points = samples ? [...samples.points.filter(point => point.budget !== current.budget), current].sort((a, b) => a.budget - b.budget) : [];
  const max = Math.max(1, ...points.map(p => p.budget), stock.scenario.default_budget_thb, plan.budget_thb);
  const slider = /^\d+$/.test(budget) && Number.isSafeInteger(Number(budget)) ? Math.min(Number(budget), max) : current.budget;
  return <div className="plan-insights">
    <details id="desk-frontier" onToggle={event => {
      if (event.currentTarget.open) { if (status !== "ready") void compare(); }
      else active.current?.abort();
    }}><Summary label={c.frontier} chart />
      <div className="insight-body">
        {status === "ready" && samples ? <>
          <div className="current-budget"><span>{c.current.th}</span><strong>{formatThb(current.budget)} · {current.onTime}/{plan.affected.length}</strong></div>
          <BudgetChart points={points} current={current} total={plan.affected.length} exact={samples.exact && current.proven} max={max} />
          <label className="frontier-slider">{c.change.th}<input type="range" min={0} max={max} step={1} value={slider}
            disabled={locked} aria-valuetext={formatThb(slider)} onChange={event => changeBudget(event.target.value)} /></label>
        </> : status === "failed" || status === "changed" ? <div role="status"><p>{status === "changed" ? c.changed.th : c.unavailable.th}</p>
          <button type="button" className="secondary-action" disabled={locked}
            onClick={() => status === "changed" ? changeBudget(String(plan.budget_thb)) : void compare()}>
            {status === "changed" ? copy.replan.th : c.retry.th}</button></div> : <p role="status">{c.loading.th}</p>}
      </div>
    </details>
    <details id="desk-why" onToggle={event => setWhyOpen(event.currentTarget.open)}><Summary label={c.why} />
      {whyOpen && <div className="insight-body"><Why plan={plan} stock={stock} input={input} /></div>}
    </details>
  </div>;
}
