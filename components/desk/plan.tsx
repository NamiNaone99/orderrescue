import { useState, type ReactNode } from "react";
import { ChartNoAxesColumnIncreasing, Check, CircleCheck, CircleHelp, Clock3, GitCompareArrows, ListOrdered, RotateCcw, TimerOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { copy, polishCopy } from "@/lib/copy";
import type { PlanResponse } from "@/lib/domain/contracts";
import { formatThb, lineCostThb } from "@/lib/domain/money";
import { formatBangkokTime } from "@/lib/domain/time";

export const humanReason = { NO_STOCK: copy.noStock, NO_ON_TIME_SOURCE: copy.noSource, OVER_BUDGET: copy.overBudget, NOT_SELECTED: copy.notSelected };

function SolverChip({ solver }: { solver: PlanResponse["solver"] }) {
  const [open, setOpen] = useState(false);
  if (solver.optimality === "proven") return <span className="solver-chip"><CircleCheck />{copy.proven.th}</span>;
  return <Tooltip open={open} onOpenChange={setOpen}>
    <TooltipTrigger className="solver-chip limited-search" closeOnClick={false} onClick={() => setOpen(true)}
      aria-describedby={open ? "solver-limit" : undefined}><CircleHelp />{copy.bestFound.th}</TooltipTrigger>
    <TooltipContent id="solver-limit" role="tooltip">{copy.bound.th} · {solver.node_limit.toLocaleString("th-TH")}</TooltipContent>
  </Tooltip>;
}

type Strategy = PlanResponse["joint"];

function StrategyOrders({ orders, strategy }: { orders: PlanResponse["affected"]; strategy: Strategy }) {
  const assignments = new Map(strategy.lines.map(line => [line.order_id, line]));
  const reasons = new Map(strategy.needs_human.map(item => [item.order_id, item.reason]));
  if (!orders.length) return <p className="empty-orders">{copy.noAffected.th}</p>;
  return <ul className="strategy-orders" tabIndex={orders.length > 2 ? 0 : undefined}>{orders.map(order => {
    const line = assignments.get(order.order_id);
    const reason = reasons.get(order.order_id);
    const late = reason === "NO_ON_TIME_SOURCE";
    const status = line ? copy.onTime : late ? polishCopy.late : polishCopy.waiting;
    const Icon = line ? Check : late ? TimerOff : CircleHelp;
    return <li key={order.order_id}>
      <div className="order-identity"><b>#{order.order_id}</b><span className={"order-status " + (line ? "on-time" : late ? "late" : "waiting")} title={reason && humanReason[reason].th}><Icon aria-hidden />{status.th}</span></div>
      <div className="order-timing"><span>{copy.deadline.th} <b>{formatBangkokTime(order.deadline_at)}</b></span>
        {line ? <span>{copy.warehouse.th} <b>{line.warehouse_id}</b> · {copy.readyTime.th} <b>{formatBangkokTime(line.ready_at)}</b></span>
          : <span>{reason && humanReason[reason].th}</span>}</div>
      {line && <p className="line-extra-cost">{line.qty} หน่วย × {formatThb(line.unit_cost_thb)} = <b>{formatThb(lineCostThb(line.unit_cost_thb, line.qty))}</b></p>}
    </li>;
  })}</ul>;
}

function StrategySkeleton() {
  return <div className="strategy-result strategy-skeleton" aria-hidden>
    <div className="score-line"><strong className="score skeleton-line">0/0</strong></div>
    <p className="strategy-cost"><b className="skeleton-line">0000</b></p>
    <div className="strategy-note"><i className="skeleton-line">000000000</i></div>
    <ul className="strategy-orders">{[0, 1].map(row => <li key={row}>
      <div className="order-identity"><b className="skeleton-line">0000</b><i className="skeleton-line">0000</i></div>
      <div className="order-timing"><i className="skeleton-line">000000</i><i className="skeleton-line">00000000</i></div>
    </li>)}</ul>
  </div>;
}

function DecisionSummary({ plan }: { plan: PlanResponse }) {
  const [loss, setLoss] = useState("");
  const gain = plan.joint.on_time - plan.first_come.on_time;
  const extra = plan.joint.extra_cost_thb - plan.first_come.extra_cost_thb;
  const firstOrders = new Set(plan.first_come.lines.map(line => line.order_id));
  const addedOrders = plan.joint.lines.filter(line => !firstOrders.has(line.order_id));
  const lossScope = addedOrders.length === 1 ? "#" + addedOrders[0].order_id : gain + " ใบที่ส่งทันเพิ่ม";
  const estimate = /^\d+$/.test(loss) && Number.isSafeInteger(Number(loss)) ? Number(loss) : null;
  const difference = estimate === null ? null : estimate - extra;
  if (!plan.affected.length) return null;
  return <section className="decision-summary" aria-label="ผลต่างของสองแผน">
    <p className="decision-scope">{plan.affected.length} ออเดอร์เสี่ยงพลาดรอบ</p>
    {gain > 0 ? <>
      <p className="decision-lead"><strong>ส่งทันเพิ่ม {gain} ใบ</strong>
        {" · "}{extra > 0 ? <>จ่ายเพิ่มอีก <strong>{formatThb(extra)}</strong></>
          : extra === 0 ? "จ่ายเท่ากัน" : <>จ่ายน้อยลง <strong>{formatThb(-extra)}</strong></>}</p>
      <p className="decision-context">เทียบกับส่งตามคิวเดิม{addedOrders.length === 1 && " · ใบที่ส่งทันเพิ่มคือ " + lossScope}</p>
      {extra > 0 && addedOrders.length === gain && <details className="loss-estimate">
          <summary>ลองคิดว่าจ่ายเพิ่มแล้วคุ้มไหม · คุ้มถ้าเลี่ยงค่าเสียหายได้เกิน {formatThb(extra)}</summary>
          <label htmlFor="missed-order-loss">ถ้า {lossScope} พลาดรอบ คาดว่าจะเสียกี่บาท?</label>
          <input id="missed-order-loss" type="number" min="0" step="1" inputMode="numeric" placeholder="ใส่ยอดที่คุณประเมิน"
            value={loss} onChange={event => setLoss(event.target.value)} />
          <p className="estimate-note" role="status">{difference === null
            ? <>เช่น ค่าปรับหรือค่าส่งซ้ำ ยอดที่กรอกใช้เทียบกับเงินเพิ่ม {formatThb(extra)}</>
            : difference === 0 ? "ค่าเสียหายที่คาดไว้เท่ากับเงินที่จ่ายเพิ่ม"
              : difference > 0 ? <>ถ้าประเมินถูก แผนนี้ลดค่าใช้จ่ายสุทธิได้ {formatThb(difference)}</>
                : <>ถ้าประเมินถูก แผนนี้จ่ายเพิ่มเกินค่าเสียหายที่เลี่ยงได้ {formatThb(-difference)}</>}</p>
        </details>}
    </> : <p className="decision-lead"><strong>จัดคลังใหม่ส่งทัน {plan.joint.on_time} จาก {plan.joint.total} ใบ</strong></p>}
  </section>;
}

export function PlanCompare({ plan, loading, booked, stale, notice, reset, resetDisabled }: { plan: PlanResponse | null; loading: boolean; booked: boolean; stale: boolean; notice?: ReactNode; reset?: () => void; resetDisabled: boolean }) {
  const orders = [...(plan?.affected ?? [])].sort((a, b) => a.deadline_at.localeCompare(b.deadline_at) || a.order_id.localeCompare(b.order_id));
  return <section id="desk-plans" tabIndex={-1} className={"desk-panel plan-panel" + (stale ? " stale-plan" : "")}
    data-plan-state={plan ? "ready" : loading ? "loading" : "empty"} aria-labelledby="compare-heading" aria-busy={loading}>
    <div className="panel-heading"><span className="panel-icon"><GitCompareArrows aria-hidden /></span>
      <div><h2 id="compare-heading">{copy.compare.th}</h2><span lang="en">{copy.compare.en}</span></div>
      {plan && <SolverChip solver={plan.solver} />}
      {!plan && loading && <span className="solver-chip solver-placeholder" aria-hidden><CircleCheck />{copy.proven.th}</span>}</div>
    {notice}
    {plan && !stale && !booked && <DecisionSummary key={plan.plan_hash} plan={plan} />}
    {!plan && !loading && <div className="plan-start"><Clock3 aria-hidden /><div>
      <h3>ดูว่าคลังอื่นช่วยส่งทันไหม</h3><p>{copy.hint.th}</p></div></div>}
    {(plan || loading) && <div className="strategy-grid">{(["first_come", "joint"] as const).map(key => {
      const joint = key === "joint";
      const label = joint ? copy.joint : copy.firstCome;
      const result = plan?.[key];
      const Icon = joint ? ChartNoAxesColumnIncreasing : ListOrdered;
      return <article aria-label={label.th} key={key} className={"strategy " + (joint ? "joint" : "baseline")}>
        <div className="strategy-title"><Icon aria-hidden /><div><h3>{label.th}</h3>
          <span>{joint ? copy.jointExplain.th : copy.firstExplain.th}</span></div></div>
        {result ? <div className="strategy-result"><div className="score-line">
          <strong className="score" key={result.on_time + "/" + result.total}>{result.on_time}<span>/{result.total}</span></strong><span className="score-label">{copy.onTime.th}</span></div>
          <p className="strategy-cost"><span>{copy.extraCost.th}</span><b>{formatThb(result.extra_cost_thb)}</b></p>
          <div className="strategy-note">{result.total === result.on_time
            ? (result.total ? "ทันรอบครบทุกใบ" : copy.noAffected.th)
            : <>อีก {result.total - result.on_time} ใบยังต้องจัดการ</>}</div>
          <StrategyOrders orders={orders} strategy={result} /></div> : <StrategySkeleton />}
      </article>;
    })}</div>}
    {plan && <OrderTable plan={plan} booked={booked} orders={orders} />}
    {plan && !plan.affected.length && reset && <button type="button" className="outline-action empty-reset" disabled={resetDisabled} onClick={reset}><RotateCcw aria-hidden />{copy.reset.th}</button>}
    {!plan && loading && <div className="order-summary-skeleton" aria-hidden><i /><i /><i /></div>}
  </section>;
}

function OrderTable({ plan, booked, orders }: { plan: PlanResponse; booked: boolean; orders: PlanResponse["affected"] }) {
  const joint = new Map(plan.joint.lines.map(line => [line.order_id, line]));
  const first = new Map(plan.first_come.lines.map(line => [line.order_id, line]));
  const reasons = new Map(plan.joint.needs_human.map(line => [line.order_id, line.reason]));
  const summary = !orders.length ? copy.noAffected : !joint.size
    ? (plan.joint.needs_human.every(row => row.reason === "OVER_BUDGET") ? copy.budgetNone : copy.nothingSaved)
    : plan.joint.needs_human.length ? copy.needsHuman : copy.inTimeFull;
  const columns = [copy.order, copy.arrived, copy.deadline, copy.quantity, copy.firstCome, copy.joint, copy.readyTime, copy.unitCost, copy.status];
  return <div className="orders"><div className="section-title"><h3>{copy.affected.th}</h3><span>{orders.length}</span></div>
    <p className={"outcome-note " + (plan.joint.needs_human.length ? "partial" : "")}>{plan.joint.needs_human.length ? <CircleHelp /> : <CircleCheck />}{summary.th}
      {joint.size > 0 && plan.joint.needs_human.map(row => " #" + row.order_id).join(",")}</p>
    {!!orders.length && <div className="order-scroll" role="region" aria-label={copy.affected.th} tabIndex={0}><table className="order-table"><thead><tr>{columns.map(c => <th scope="col" key={c.en}>{c.th}</th>)}</tr></thead>
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
