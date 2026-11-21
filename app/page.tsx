"use client";

import { useEffect, useRef, useState } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { GuidedDemo, editTourUrl } from "@/components/desk/guided-demo";
import { DemoGuide } from "@/components/desk/demo-guide";
import { copy } from "@/lib/copy";
import { useDesk, validBudget } from "@/lib/client/use-desk";
import { formatBangkokTime } from "@/lib/domain/time";
import { DataBadge } from "@/components/header";
import { useScenario, useDeskQuery } from "@/components/scenario-shell";
import { ClarificationCard, IncidentCard, IncidentSkeleton, MessageInput } from "@/components/desk/message";
import { BudgetControl, StockPanel } from "@/components/desk/controls";
import { ConfirmDialog, ErrorNotice, Receipt } from "@/components/desk/booking";
import { PlanCompare } from "@/components/desk/plan";
import { DemoEvents } from "@/components/DemoEvents";
import { StaleBanner } from "@/components/StaleBanner";
import { ManualIncidentForm } from "@/components/ManualIncidentForm";
import { useServiceHealth } from "@/components/mode-badges";
import { PlanInsights } from "@/components/desk/plan-insights";

function reveal(panel: HTMLElement) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  panel.scrollIntoView({ block: "nearest", behavior: reduced ? "instant" : "smooth" });
}

const steps = [copy.stepMessage, copy.stepIncident, copy.stepPlan, copy.stepConfirm];

export default function DeskPage() {
  const scenario = useScenario();
  const query = useDeskQuery();
  const params = new URLSearchParams(query);
  const desk = useDesk(scenario.id, scenario, params.get("receipt"));
  const { s, restored: saved, stockSku: sku } = desk;
  const touring = scenario.id === "hero" && params.get("tour") === "1";
  const [tourHost, setTourHost] = useState<HTMLDivElement | null>(null);
  const shownReceipt = s.booked ?? (saved ? { receipt: saved } : null);
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
  const revealInitialPlan = useRef(false);
  function analyse() {
    setManualOpen(false);
    revealInitialPlan.current = !document.activeElement?.matches(":focus-visible");
    void desk.analyse();
  }
  useEffect(() => {
    if (touring) return;
    if (s.booked) document.getElementById("desk-receipt")?.focus();
    else if ((s.interpretation || s.manualIncident) && !document.querySelector('[role="dialog"]')) {
      const incident = document.getElementById("desk-incident");
      if (incident) {
        incident.focus({ preventScroll: true });
        reveal(incident);
      }
    }
  }, [s.interpretation, s.manualIncident, s.booked, touring]);
  useEffect(() => {
    if (touring || !s.plan || !revealInitialPlan.current) return;
    revealInitialPlan.current = false;
    const timer = window.setTimeout(() => {
      if (document.activeElement?.id === "desk-incident" && !document.querySelector('[role="dialog"]')) {
        const panel = document.getElementById("desk-plans");
        if (panel) reveal(panel);
      }
    }, 700);
    const cancel = () => window.clearTimeout(timer);
    window.addEventListener("wheel", cancel, { once: true, passive: true });
    window.addEventListener("touchstart", cancel, { once: true, passive: true });
    window.addEventListener("keydown", cancel, { once: true });
    return () => {
      cancel();
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("keydown", cancel);
    };
  }, [s.plan, touring]);
  const step = manualOpen ? 1 : shownReceipt || s.confirmation ? 3 : s.plan ? 2 : s.interpretation || s.manualIncident ? 1 : 0;
  const locked = !!shownReceipt || !!s.confirmation || !!s.stale;
  const manualDisabled = !s.stock || !!s.confirmation || s.busy === "book" || s.busy === "reset" || s.busy === "event";
  const loading = s.busy === "plan" || s.busy === "interpret";
  const meta = s.interpretation?.interpreter;
  const fallback = meta && (meta.used === "offline" || meta.rate_limited || meta.attempts.some(attempt => attempt.name !== meta.used));
  const analysis = desk.incident ? copy.incidentAnnouncement.th.replace("{kind}", s.manualIncident ? copy.manualEntered.th : copy.incident.th)
    .replace("{warehouse}", desk.incident.warehouse_id).replace("{skus}", s.interpretation?.incident?.sku_ids.join(", ") ?? s.sku)
    .replace("{start}", formatBangkokTime(desk.incident.window_start)).replace("{end}", formatBangkokTime(desk.incident.window_end))
    : s.interpretation?.clarification?.question_th ?? (s.interpretation?.outcome === "ignore" ? copy.notPicking.th : "");
  const summary = s.plan && (s.plan.affected.length ? copy.planAnnouncement.th.replace("{served}", String(s.plan.joint.on_time))
    .replace("{total}", String(s.plan.joint.total)).replace("{cost}", String(s.plan.joint.extra_cost_thb)) : copy.noAffected.th);
  const interpreterNote = fallback && <p className="fallback-note">{copy.interpreterFallback.th} · <b lang="en">{meta.used}</b>
          {meta.rate_limited && <> · {copy.interpreterQuota.th}</>}</p>;
  function mobileAction() {
    if (manualOpen) return "manual";
    if (s.confirmation) return "dialog";
    if (s.stale) return "replan";
    if (s.error) return "retry";
    if (shownReceipt) return "new";
    if (s.plan) {
      if (!s.plan.affected.length && scenario.id === "hero") return "reset";
      if (!s.plan.joint.lines.length && s.plan.joint.needs_human.some(row => row.reason === "OVER_BUDGET")) return "budget";
      return "confirm";
    }
    if (s.interpretation?.outcome === "clarification") return "edit";
    if (s.interpretation?.outcome === "incident") return s.sku ? "incident" : "choose";
    if (s.interpretation?.outcome === "ignore") return "rewrite";
    return "analyse";
  }
  return <div className="shell-width desk dispatch" data-step={step} data-scenario={scenario.id} data-action={mobileAction()} data-touring={touring || undefined}>
    <div className="desk-heading"><div><div className="heading-line"><h1>{copy.desk.th}</h1><span lang="en">{copy.desk.en}</span></div>
      <p>{copy.tagline.th}</p></div><div className="desk-heading-tools"><DataBadge scenario={scenario} /><DemoGuide /></div></div>
    <ol className="workflow" aria-label={copy.workflow.th}>{steps.map((label, i) => <li data-complete={i < step || (!!shownReceipt && !manualOpen)} aria-current={i === step ? "step" : undefined} key={label.en}>
      <span className="step-count">{i < step || (shownReceipt && !manualOpen) ? <Check aria-hidden /> : i + 1}</span>{label.th}{i < 3 && <span className="step-rule" aria-hidden />}</li>)}</ol>
    <div id="desk-announcements" className="sr-only" role="status" aria-live="polite" aria-atomic="false">
      <p>{s.busy === "interpret" ? copy.analysing.th : analysis}</p>
      <p>{s.stale ? (s.stale.refusal ? copy.bookingRefused.th : copy.stockChanged.th) : s.busy === "plan" ? copy.planning.th : summary}</p>
      <p>{shownReceipt ? (s.booked?.replayed ? copy.replayed.th : copy.booked.th) : s.error?.operation === "book" ? copy.bookingRefused.th : ""}</p>
    </div>
    {health?.degraded && <div className="desk-error storage-banner" role="status"><TriangleAlert aria-hidden /><strong>{copy.degraded.th}</strong></div>}
    {s.error && !s.confirmation && <ErrorNotice error={s.error.api} retry={desk.retry} booking={s.error.operation === "book"} />}
    <div className="desk-grid">
      <div className="message-column"><MessageInput message={s.message} samples={s.stock?.scenario.sample_messages ?? scenario.sample_messages}
        edit={text => { setManualOpen(false); desk.edit(text); }} analyse={analyse}
        pending={s.busy === "interpret"} locked={locked || (!!s.error && !s.stock)} editingDisabled={!s.stock} inputRef={input} onManual={openManual} manualOpen={manualOpen} manualDisabled={manualDisabled} />
        {s.busy === "interpret" && !s.interpretation && <IncidentSkeleton />}
        {s.interpretation?.outcome === "incident" && <IncidentCard answer={s.interpretation} message={s.evidenceMessage} sku={s.sku}
          catalog={s.catalog} note={interpreterNote} edit={() => input.current?.focus()} select={id => desk.select(id, s.budget)} locked={locked} />}
        {s.interpretation?.outcome === "clarification" && <ClarificationCard answer={s.interpretation}
          onEdit={() => { setManualOpen(false); input.current?.focus(); }} onManual={openManual} manualOpen={manualOpen} />}
        {s.interpretation?.outcome === "ignore" && <p id="desk-incident" tabIndex={-1} className="desk-panel">{copy.notPicking.th}</p>}
        {s.interpretation?.outcome === "ignore" && <button className="text-action rewrite-action" onClick={() => input.current?.focus()}>{copy.editMessage.th}</button>}
        {s.interpretation?.outcome !== "incident" && interpreterNote}
        {manualOpen && s.stock && !manualDisabled && <ManualIncidentForm stock={s.stock} skus={s.catalog} previous={s.manualIncident}
          budgetValid={validBudget(s.budget)} cancel={closeManual} submit={incident => { setManualOpen(false); void desk.planManually(incident); }} />}
        {s.manualIncident && !manualOpen && <section className="desk-panel" id="desk-incident" tabIndex={-1} aria-labelledby="manual-result">
          <h2 id="manual-result">{copy.manualEntered.th}</h2><p>{copy.warehouse.th} {s.manualIncident.warehouse_id} · {s.manualIncident.sku_id}</p>
          <p>{copy.blocked.th} {formatBangkokTime(s.manualIncident.window_start)}–{formatBangkokTime(s.manualIncident.window_end)}</p></section>}
      </div>
      <PlanCompare plan={s.plan} loading={loading} booked={!!shownReceipt} stale={!!s.stale}
        notice={s.stale && <StaleBanner changes={s.stale.changes} refusal={s.stale.refusal} pending={!!s.busy} replan={desk.replan} />}
        reset={scenario.id === "hero" ? () => { setManualOpen(false); void desk.startAgain(); } : undefined} resetDisabled={!!s.busy || !!health?.degraded} />
      <div className="stock-column"><StockPanel stock={s.stock} sku={sku} incident={desk.incident} plan={s.plan} receipt={shownReceipt?.receipt} waiting={s.busy === "interpret"} />
        <DemoEvents events={s.stock?.scenario.demo_events ?? scenario.demo_events} disabled={!s.stock || !!s.busy || !!s.confirmation} apply={desk.applyEvent} /></div>
      {!shownReceipt && <BudgetControl value={s.budget} change={v => desk.select(s.sku,v,true)} plan={s.plan} hero={scenario.id === "hero"}
        busy={!!s.busy} locked={!s.stock || locked} stale={!!s.stale} canBook={!!s.plan?.joint.lines.length && !!s.plannedInput && !s.error && !health?.degraded && !manualOpen} open={desk.openDialog} />}
      {shownReceipt && <Receipt result={shownReceipt} plan={s.plan} newIncident={() => {
        if (params.has("receipt")) editTourUrl(p => p.delete("receipt"));
        void desk.startAgain();
      }} busy={!!s.busy} />}
      {!shownReceipt && <PlanInsights desk={desk} locked={locked || !!s.busy || manualOpen} />}
    </div>
    <ConfirmDialog input={s.confirmation} plan={s.plan} busy={s.busy === "book"} degraded={!!health?.degraded} error={s.error?.operation === "book" ? s.error.api : null}
      tourHost={touring ? setTourHost : undefined} cancel={desk.closeDialog} book={desk.book} replan={desk.retry} />
    {touring && <GuidedDemo desk={desk} query={query} host={tourHost} degraded={!!health?.degraded} restored={saved} />}
  </div>;
}
