"use client";

import { useEffect, useRef } from "react";
import { copy } from "@/lib/copy";
import { useDesk } from "@/lib/client/use-desk";
import { DataBadge } from "@/components/header";
import { useScenario } from "@/components/scenario-shell";
import { ClarificationCard, IncidentCard, MessageInput } from "@/components/desk/message";
import { BudgetControl, StockPanel } from "@/components/desk/controls";
import { ConfirmDialog, ErrorNotice, Receipt } from "@/components/desk/booking";
import { PlanCompare } from "@/components/desk/plan";
import { DemoEvents } from "@/components/DemoEvents";
import { StaleBanner } from "@/components/StaleBanner";

const steps = [copy.stepMessage, copy.stepIncident, copy.stepPlan, copy.stepConfirm];

export default function DeskPage() {
  const scenario = useScenario();
  const desk = useDesk(scenario.id);
  const { s } = desk;
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (s.booked) document.getElementById("desk-receipt")?.focus();
    else if (s.interpretation) document.getElementById("desk-incident")?.focus({ preventScroll: true });
  }, [s.interpretation, s.booked]);
  const step = s.booked || s.confirmation ? 3 : s.plan ? 2 : s.interpretation ? 1 : 0;
  const locked = !!s.booked || !!s.confirmation || !!s.stale;
  const sku = s.sku || scenario.default_sku_id;
  const loading = s.busy === "plan" || s.busy === "interpret" || s.busy === "load";
  return <div className="shell-width desk dispatch">
    <div className="desk-heading"><div><div className="heading-line"><h1>{copy.desk.th}</h1><span lang="en">{copy.desk.en}</span></div>
      <p>{copy.tagline.th}</p></div><DataBadge scenario={scenario} /></div>
    <ol className="workflow" aria-label={copy.workflow.th}>{steps.map((label, i) => <li aria-current={i === step ? "step" : undefined} key={label.en}>
      <span className="step-count">{i+1}</span>{label.th}{i < 3 && <span className="step-rule" aria-hidden />}</li>)}</ol>
    <div className="sr-only" role="status" aria-live="polite">{s.booked ? copy.booked.th : s.stale ? (s.stale.refusal ? copy.bookingRefused.th : copy.stockChanged.th) : s.busy === "interpret" ? copy.analysing.th :
      s.busy === "plan" ? copy.planning.th : s.plan ? [copy.joint.th,copy.onTime.th,s.plan.joint.on_time + "/" + s.plan.joint.total,copy.extraCost.th,"฿" + s.plan.joint.extra_cost_thb].join(" ")
      : s.interpretation?.clarification?.question_th ?? ""}</div>
    {s.error && !s.confirmation && <ErrorNotice error={s.error.api} retry={desk.retry} booking={s.error.operation === "book"} />}
    {s.stale && <StaleBanner changes={s.stale.changes} refusal={s.stale.refusal} pending={!!s.busy} replan={desk.replan} />}
    <div className="desk-grid">
      <div className="message-column"><MessageInput message={s.message} samples={s.stock?.scenario.sample_messages ?? []}
        edit={desk.edit} analyse={desk.analyse} pending={s.busy === "interpret"} locked={!s.stock || locked} inputRef={input} />
        {s.interpretation?.outcome === "incident" && <IncidentCard answer={s.interpretation} message={s.evidenceMessage} sku={s.sku}
          catalog={s.catalog} select={id => desk.select(id, s.budget)} locked={locked} />}
        {s.interpretation?.outcome === "clarification" && <ClarificationCard answer={s.interpretation} onEdit={() => input.current?.focus()} />}
        {s.interpretation?.outcome === "ignore" && <p className="desk-panel" role="status">{copy.notPicking.th}</p>}
      </div>
      <PlanCompare plan={s.plan} loading={loading} booked={!!s.booked} stale={!!s.stale} />
      <div className="stock-column"><StockPanel stock={s.stock} sku={sku} incident={s.interpretation?.incident ?? null} plan={s.plan} />
        {s.stock && <DemoEvents events={s.stock.scenario.demo_events} disabled={!!s.busy || !!s.confirmation} apply={desk.applyEvent} />}</div>
      {s.stock && !s.booked && <BudgetControl value={s.budget} change={v => desk.select(s.sku,v,true)} plan={s.plan} hero={scenario.id === "hero"}
        busy={!!s.busy} locked={locked} canBook={!!s.plan?.joint.lines.length && !!s.plannedInput && !s.error} open={desk.openDialog} />}
      {s.booked && s.plan && <Receipt result={s.booked} plan={s.plan} newIncident={desk.startAgain} busy={!!s.busy} />}
    </div>
    <ConfirmDialog input={s.confirmation} plan={s.plan} busy={s.busy === "book"} error={s.error?.operation === "book" ? s.error.api : null}
      cancel={desk.closeDialog} book={desk.book} replan={desk.retry} />
  </div>;
}
