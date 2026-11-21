import { ArrowRight, ChartNoAxesColumnIncreasing, Check, CircleCheck, CircleHelp, GitCompareArrows, ListOrdered, LoaderCircle } from "lucide-react";
import { copy } from "@/lib/copy";
import type { PlanResponse } from "@/lib/domain/contracts";
import { formatThb } from "@/lib/domain/money";
import { formatBangkokTime } from "@/lib/domain/time";

export const humanReason = { NO_STOCK: copy.noStock, NO_ON_TIME_SOURCE: copy.noSource, OVER_BUDGET: copy.overBudget, NOT_SELECTED: copy.notSelected };

export function PlanCompare({ plan, loading, booked, stale }: { plan: PlanResponse | null; loading: boolean; booked: boolean; stale: boolean }) {
  const gain = plan && plan.joint.on_time - plan.first_come.on_time;
  const extra = plan && plan.joint.extra_cost_thb - plan.first_come.extra_cost_thb;
  return <section className={"desk-panel plan-panel" + (stale ? " stale-plan" : "")} aria-labelledby="compare-heading" aria-busy={loading}>
    <div className="panel-heading"><span className="panel-icon"><GitCompareArrows /></span>
      <div><h2 id="compare-heading">{copy.compare.th}</h2><span lang="en">{copy.compare.en}</span></div>
      {loading && <LoaderCircle className="spin" aria-label={copy.planning.th} />}</div>
    <div className="strategy-grid">{(["first_come", "joint"] as const).map(key => {
      const joint = key === "joint", label = joint ? copy.joint : copy.firstCome, result = plan?.[key];
      const Icon = joint ? ChartNoAxesColumnIncreasing : ListOrdered;
      return <article aria-label={label.th} key={key} className={"strategy " + (joint ? "joint" : "baseline")}>
        <div className="strategy-title"><Icon size={19} /><div><h3>{label.th}</h3><span lang="en">{label.en}</span></div></div>
        <div className={"score" + (loading && !result ? " skeleton-score" : "")}>{result ? result.on_time + "/" + result.total : "—"}</div>
        <span className="score-label"><Check size={15} />{copy.onTime.th}</span>
        <dl><div><dt>{copy.extraCost.th}</dt><dd>{result ? formatThb(result.extra_cost_thb) : "—"}</dd></div></dl>
        <small>{joint ? copy.jointExplain.th : copy.firstExplain.th}</small>
      </article>;
    })}</div>
    {plan ? <><div className="comparison-notes"><span className="solver-chip" title={plan.solver.optimality === "best_found" ? copy.bound.th + " · " + plan.solver.node_limit : undefined}><CircleCheck />{plan.solver.optimality === "proven" ? copy.proven.th : copy.bestFound.th}</span>
      {gain !== null && gain > 0 && <span className="delta-chip">+{gain} {copy.onTimeGain.th}</span>}
      {extra !== null && extra !== 0 && <span className="delta-chip">{extra > 0 ? "+" : ""}{formatThb(extra)}</span>}</div>
      <OrderTable plan={plan} booked={booked} /></> : <p className="plan-hint"><ArrowRight size={16} />{loading ? copy.planning.th : copy.hint.th}</p>}
  </section>;
}

export function OrderTable({ plan, booked }: { plan: PlanResponse; booked: boolean }) {
  const joint = new Map(plan.joint.lines.map(line => [line.order_id, line]));
  const first = new Map(plan.first_come.lines.map(line => [line.order_id, line]));
  const reasons = new Map(plan.joint.needs_human.map(line => [line.order_id, line.reason]));
  const orders = [...plan.affected].sort((a,b) => a.deadline_at.localeCompare(b.deadline_at) || a.order_id.localeCompare(b.order_id));
  const summary = !orders.length ? copy.noAffected : !joint.size
    ? (plan.joint.needs_human.every(row => row.reason === "OVER_BUDGET") ? copy.budgetNone : copy.nothingSaved)
    : plan.joint.needs_human.length ? copy.needsHuman : copy.inTimeFull;
  const columns = [copy.order, copy.arrived, copy.deadline, copy.quantity, copy.firstCome, copy.joint, copy.readyTime, copy.unitCost, copy.status];
  return <div className="orders"><div className="section-title"><h3>{copy.affected.th}</h3><span>{orders.length}</span></div>
    <p className={"outcome-note " + (plan.joint.needs_human.length ? "partial" : "")}>{plan.joint.needs_human.length ? <CircleHelp /> : <CircleCheck />}{summary.th}
      {joint.size > 0 && plan.joint.needs_human.map(row => " #" + row.order_id).join(",")}</p>
    {!!orders.length && <div className="order-scroll"><table className="order-table"><thead><tr>{columns.map(c => <th scope="col" key={c.en}>{c.th}</th>)}</tr></thead>
      <tbody>{orders.map(o => {
        const j = joint.get(o.order_id), f = first.get(o.order_id), reason = reasons.get(o.order_id);
        const cells = ["#" + o.order_id, formatBangkokTime(o.received_at), formatBangkokTime(o.deadline_at), o.qty,
          f?.warehouse_id ?? "—", j?.warehouse_id ?? "—", j ? formatBangkokTime(j.ready_at) : "—", j ? formatThb(j.unit_cost_thb) : "—",
          j ? (booked ? copy.booked.th : copy.onTime.th) : reason ? humanReason[reason].th : copy.needsHuman.th];
        return <tr key={o.order_id}>{cells.map((v,i) => i === 0 ? <th key={i} scope="row">{v}</th> :
          <td key={i} data-label={columns[i].th} className={i === 5 && j && j.warehouse_id !== f?.warehouse_id ? "changed-source" : undefined}>
            {v}</td>)}</tr>;
      })}</tbody></table></div>}
  </div>;
}
