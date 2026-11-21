"use client";

import { useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { copy } from "@/lib/copy";
import { useDesk, validBudget } from "@/lib/client/use-desk";
import { formatBangkokTime } from "@/lib/domain/time";
import { DataBadge } from "@/components/header";
import { useScenario } from "@/components/scenario-shell";
import { ClarificationCard, IncidentCard, MessageInput } from "@/components/desk/message";
import { BudgetControl, StockPanel } from "@/components/desk/controls";
import { ConfirmDialog, ErrorNotice, Receipt } from "@/components/desk/booking";
import { PlanCompare } from "@/components/desk/plan";
import { DemoEvents } from "@/components/DemoEvents";
import { StaleBanner } from "@/components/StaleBanner";
import { ManualIncidentForm } from "@/components/ManualIncidentForm";
import { useServiceHealth } from "@/components/mode-badges";
import "./desk-states.css";

const steps = [copy.stepMessage, copy.stepIncident, copy.stepPlan, copy.stepConfirm];

export default function DeskPage() {
  const scenario = useScenario();
  const desk = useDesk(scenario.id);
  const { s } = desk;
  const health = useServiceHealth();
  const input = useRef<HTMLTextAreaElement>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  function openManual() {
    if (manualOpen) {
      document.getElementById("manual-warehouse")?.focus();
      return;
    }
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setManualOpen(true);
  }
  function closeManual() {
    setManualOpen(false);
    opener.current?.focus();
  }
  useEffect(() => {
    if (s.booked) document.getElementById("desk-receipt")?.focus();
    else if (s.interpretation || s.manualIncident) document.getElementById("desk-incident")?.focus({ preventScroll: true });
  }, [s.interpretation, s.manualIncident, s.booked]);
  const step = s.booked || s.confirmation ? 3 : s.plan ? 2 : s.interpretation || s.manualIncident ? 1 : 0;
  const locked = !!s.booked || !!s.confirmation || !!s.stale;
  const manualDisabled = !s.stock || !!s.confirmation || s.busy === "book" || s.busy === "reset" || s.busy === "event";
  const sku = s.sku || scenario.default_sku_id;
  const loading = s.busy === "plan" || s.busy === "interpret" || s.busy === "load";
  const meta = s.interpretation?.interpreter;
  const fallback = meta && (meta.used === "offline" || meta.rate_limited || meta.attempts.some(attempt => attempt.name !== meta.used));
  const analysis = desk.incident ? copy.incidentAnnouncement.th.replace("{kind}", s.manualIncident ? copy.manualEntered.th : copy.incident.th)
    .replace("{warehouse}", desk.incident.warehouse_id).replace("{skus}", s.interpretation?.incident?.sku_ids.join(", ") ?? s.sku)
    .replace("{start}", formatBangkokTime(desk.incident.window_start)).replace("{end}", formatBangkokTime(desk.incident.window_end))
    : s.interpretation?.clarification?.question_th ?? (s.interpretation?.outcome === "ignore" ? copy.notPicking.th : "");
  const summary = s.plan && (s.plan.affected.length ? copy.planAnnouncement.th.replace("{served}", String(s.plan.joint.on_time))
    .replace("{total}", String(s.plan.joint.total)).replace("{cost}", String(s.plan.joint.extra_cost_thb)) : copy.noAffected.th);
  return <div className="shell-width desk dispatch">
    <div className="desk-heading"><div><div className="heading-line"><h1>{copy.desk.th}</h1><span lang="en">{copy.desk.en}</span></div>
      <p>{copy.tagline.th}</p></div><DataBadge scenario={scenario} /></div>
    <ol className="workflow" aria-label={copy.workflow.th}>{steps.map((label, i) => <li aria-current={i === step ? "step" : undefined} key={label.en}>
      <span className="step-count">{i+1}</span>{label.th}{i < 3 && <span className="step-rule" aria-hidden />}</li>)}</ol>
    <div id="desk-announcements" className="sr-only" role="status" aria-live="polite" aria-atomic="false">
      <p>{s.busy === "interpret" ? copy.analysing.th : analysis}</p>
      <p>{s.stale ? (s.stale.refusal ? copy.bookingRefused.th : copy.stockChanged.th) : s.busy === "plan" ? copy.planning.th : summary}</p>
      <p>{s.booked ? (s.booked.replayed ? copy.replayed.th : copy.booked.th) : s.error?.operation === "book" ? copy.bookingRefused.th : ""}</p>
    </div>
    {health?.degraded && <div className="desk-error storage-banner" role="status"><TriangleAlert aria-hidden /><strong>{copy.degraded.th}</strong></div>}
    {s.error && !s.confirmation && <ErrorNotice error={s.error.api} retry={desk.retry} booking={s.error.operation === "book"} />}
    {s.stale && <StaleBanner changes={s.stale.changes} refusal={s.stale.refusal} pending={!!s.busy} replan={desk.replan} />}
    <div className="desk-grid">
      <div className="message-column"><MessageInput message={s.message} samples={s.stock?.scenario.sample_messages ?? []}
        edit={text => { setManualOpen(false); desk.edit(text); }} analyse={() => { setManualOpen(false); void desk.analyse(); }}
        pending={s.busy === "interpret"} locked={!s.stock || locked} inputRef={input} onManual={openManual} manualOpen={manualOpen} manualDisabled={manualDisabled} />
        {s.interpretation?.outcome === "incident" && <IncidentCard answer={s.interpretation} message={s.evidenceMessage} sku={s.sku}
          catalog={s.catalog} select={id => desk.select(id, s.budget)} locked={locked} />}
        {s.interpretation?.outcome === "clarification" && <ClarificationCard answer={s.interpretation}
          onEdit={() => { setManualOpen(false); input.current?.focus(); }} onManual={openManual} manualOpen={manualOpen} />}
        {s.interpretation?.outcome === "ignore" && <p id="desk-incident" tabIndex={-1} className="desk-panel">{copy.notPicking.th}</p>}
        {fallback && <p className="fallback-note">{copy.interpreterFallback.th} · <b lang="en">{meta.used}</b>
          {meta.rate_limited && <> · {copy.interpreterQuota.th}</>}</p>}
        {manualOpen && s.stock && !manualDisabled && <ManualIncidentForm stock={s.stock} skus={s.catalog} previous={s.manualIncident}
          budgetValid={validBudget(s.budget)} cancel={closeManual} submit={incident => { setManualOpen(false); void desk.planManually(incident); }} />}
        {s.manualIncident && !manualOpen && <section className="desk-panel" id="desk-incident" tabIndex={-1} aria-labelledby="manual-result">
          <h2 id="manual-result">{copy.manualEntered.th}</h2><p>{copy.warehouse.th} {s.manualIncident.warehouse_id} · {s.manualIncident.sku_id}</p>
          <p>{copy.blocked.th} {formatBangkokTime(s.manualIncident.window_start)}–{formatBangkokTime(s.manualIncident.window_end)}</p></section>}
      </div>
      <PlanCompare plan={s.plan} loading={loading} booked={!!s.booked} stale={!!s.stale}
        reset={scenario.id === "hero" ? () => { setManualOpen(false); void desk.startAgain(); } : undefined} resetDisabled={!!s.busy || !!health?.degraded} />
      <div className="stock-column"><StockPanel stock={s.stock} sku={sku} incident={desk.incident} plan={s.plan} />
        {s.stock && <DemoEvents events={s.stock.scenario.demo_events} disabled={!!s.busy || !!s.confirmation} apply={desk.applyEvent} />}</div>
      {s.stock && !s.booked && <BudgetControl value={s.budget} change={v => desk.select(s.sku,v,true)} plan={s.plan} hero={scenario.id === "hero"}
        busy={!!s.busy} locked={locked} canBook={!!s.plan?.joint.lines.length && !!s.plannedInput && !s.error && !health?.degraded && !manualOpen} open={desk.openDialog} />}
      {s.booked && s.plan && <Receipt result={s.booked} plan={s.plan} newIncident={desk.startAgain} busy={!!s.busy} />}
    </div>
    <ConfirmDialog input={s.confirmation} plan={s.plan} busy={s.busy === "book"} degraded={!!health?.degraded} error={s.error?.operation === "book" ? s.error.api : null}
      cancel={desk.closeDialog} book={desk.book} replan={desk.retry} />
  </div>;
}
