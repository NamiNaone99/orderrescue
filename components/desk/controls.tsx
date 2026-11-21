import { Boxes, Check, LockKeyhole, Wallet } from "lucide-react";
import { copy } from "@/lib/copy";
import type { PlanRequest, PlanResponse, StateResponse } from "@/lib/domain/contracts";
import { formatThb } from "@/lib/domain/money";
import { formatBangkokTime } from "@/lib/domain/time";
import { validBudget } from "@/lib/client/use-desk";

export function StockPanel({ stock, sku, incident, plan }: {
  stock: StateResponse | null; sku: string; incident?: Pick<PlanRequest["incident"], "warehouse_id" | "window_start" | "window_end"> | null; plan: PlanResponse | null;
}) {
  const rows = stock?.stock.filter(row => row.sku_id === sku) ?? [];
  const used = new Set(plan?.joint.lines.map(line => line.warehouse_id));
  return <section className="desk-panel stock-panel" aria-labelledby="stock-heading">
    <div className="panel-heading"><span className="panel-icon"><Boxes /></span><div><h2 id="stock-heading">{copy.stock.th}</h2><span lang="en">{copy.stock.en}</span></div><b className="sku-pill">{sku}</b></div>
    <div className="stock-list">{rows.map(row => <article className="stock-row" key={row.warehouse_id} aria-label={copy.warehouse.th + " " + row.warehouse_id}>
      <div className="stock-row-head"><b>{copy.warehouse.th} {row.warehouse_id}</b>{used.has(row.warehouse_id) && <span className="stock-tag"><Check />{copy.usedWarehouse.th}</span>}
        <span className="stock-rev" title={copy.revision.th}>r{row.revision}</span></div>
      <dl>{[[copy.onHand,row.on_hand],[copy.committed,row.committed],[copy.freeStock,row.free],[copy.readyTime,formatBangkokTime(row.ready_at)],
        [copy.unitCost,formatThb(row.extra_cost_per_unit_thb)]].map(([label, v]) => typeof label === "object" &&
          <div key={label.en}><dt>{label.th}</dt><dd>{String(v)}</dd></div>)}</dl>
      {incident?.warehouse_id === row.warehouse_id && <p className="blocked-time"><LockKeyhole />{copy.blocked.th} {formatBangkokTime(incident.window_start)}–{formatBangkokTime(incident.window_end)}</p>}
    </article>)}</div>
    {!stock && <div className="stock-skeleton skeleton-score" aria-busy="true" />}
  </section>;
}

export function BudgetControl({ value, change, plan, hero, busy, locked, canBook, open }: {
  value: string; change: (v: string) => void; plan: PlanResponse | null; hero: boolean; busy: boolean;
  locked: boolean; canBook: boolean; open: () => void;
}) {
  const invalid = !validBudget(value);
  const current = plan && !invalid && plan.budget_thb === Number(value) ? plan : null;
  return <section className="desk-panel budget-panel" aria-labelledby="budget-heading">
    <div className="budget-heading"><Wallet /><h2 id="budget-heading"><label htmlFor="desk-budget">{copy.budget.th}</label></h2><span lang="en">{copy.budget.en}</span></div>
    <div className="budget-inputs"><span className="budget-input"><span>฿</span><input id="desk-budget" type="number" step={1} min={0} inputMode="numeric"
      value={value} disabled={locked} aria-invalid={invalid} onChange={e => change(e.target.value)} /></span>
      {hero && <div className="budget-presets">{[100,88,87,31].map(v => <button type="button" key={v} disabled={locked} aria-pressed={String(v) === value}
        onClick={() => change(String(v))}>{formatThb(v)}</button>)}</div>}</div>
    {invalid && <p className="danger-note">{copy.budgetInvalid.th}</p>}
    <div className="budget-bottom"><div><div className="budget-track" aria-hidden><span style={{ width: current?.budget_thb ? (100 * current.joint.extra_cost_thb / current.budget_thb) + "%" : "0%" }} /></div>
      <small>{copy.used.th} {current ? formatThb(current.joint.extra_cost_thb) : "—"} · {copy.remaining.th} {current ? formatThb(current.budget_thb - current.joint.extra_cost_thb) : "—"}</small></div>
      <button type="button" className="primary-action" disabled={!canBook || busy || locked} onClick={open}><LockKeyhole />{copy.confirmRows.th}</button>
    </div>
  </section>;
}
