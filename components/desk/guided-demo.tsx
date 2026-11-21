"use client";

import { useEffect, useEffectEvent, useReducer, useRef, useState } from "react";
import { copy, tourCopy as c } from "@/lib/copy";
import { firstStep, tourPosition, type TourFacts, type TourPosition } from "@/lib/client/tour";
import { tourFacts, tourScreen, type Desk, type SavedReceipt } from "@/lib/client/tour-screen";
import { TourOverlay } from "./tour-overlay";

export function editTourUrl(change: (params: URLSearchParams) => void) {
  const url = new URL(window.location.href);
  change(url.searchParams);
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
}

type Action = { type: "next" | "observe" | "back"; facts: TourFacts } | { type: "start" | "recover" };
function position(previous: TourPosition, a: Action) {
  if (a.type === "start") return firstStep;
  if (a.type === "recover") return { step: 7, furthest: 7 };
  if ("facts" in a) return tourPosition(previous, a.type, a.facts);
  return previous;
}

function deskError(code: string) {
  if (code === "RATE_LIMITED") return copy.limited;
  if (code === "STORAGE_UNAVAILABLE") return copy.degraded;
  if (code === "STALE_STOCK") return copy.stockChanged;
  if (code === "INVALID_INPUT") return copy.invalidInput;
  return copy.requestFailed;
}

export function GuidedDemo({ desk, query, host, degraded, restored }: {
  desk: Desk; query: string; host: HTMLElement | null; degraded: boolean; restored?: SavedReceipt;
}) {
  const { s } = desk;
  const params = new URLSearchParams(query);
  const receiptId = params.get("receipt");
  const marker = params.get("tourRun") ?? "";
  const pendingStart = marker.startsWith("pending-");
  const previousStart = Number(pendingStart ? marker.slice(8) : marker);
  const resumed = Number.isSafeInteger(previousStart) && previousStart > 0;
  const [current, send] = useReducer(position, resumed && receiptId ? { step: 8, furthest: 8 } : firstStep);
  const [since, setSince] = useState(resumed ? previousStart : 0);
  const [finished, setFinished] = useState(false);
  const [starting, setStarting] = useState(false);
  const [needsReset, setNeedsReset] = useState(resumed && pendingStart);
  const [unavailableAction, setUnavailableAction] = useState("");
  const initialised = useRef(false);
  const resetLock = useRef(false);
  const retrySample = useRef<string | null>(null);
  const mounted = useRef(true);
  const receipt = s.booked?.receipt ?? restored;
  const facts = tourFacts(desk, receipt);
  const { step } = current;
  const screen = tourScreen(step, desk, facts, receipt, finished);
  const actionKey = step + ":" + (screen.action ?? "") + ":" + s.budget;
  function leave() {
    editTourUrl(p => { for (const key of ["tour", "tourRun", "notes"]) p.delete(key); });
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(".confirm-popup .dialog-actions button:enabled") ?? document.getElementById("start-guided-demo");
      target?.focus();
    });
  }
  async function restart(exitAfter = false) {
    if (resetLock.current) return;
    resetLock.current = true; setStarting(true); setFinished(false); setUnavailableAction(""); setNeedsReset(false);
    const now = Date.now();
    setSince(now);
    editTourUrl(p => { p.set("scenario", "hero"); p.set("tourRun", "pending-" + now); p.delete("receipt"); });
    send({ type: "start" });
    const ok = await desk.startAgain();
    resetLock.current = false;
    if (!mounted.current) return;
    setStarting(false);
    setNeedsReset(!ok);
    if (ok) {
      if (exitAfter) leave();
      else editTourUrl(p => p.set("tourRun", String(now)));
    }
  }
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const initialise = useEffectEvent(() => {
    if (initialised.current) return;
    initialised.current = true;
    if (!resumed) void restart();
  });
  useEffect(() => { initialise(); }, []);
  const { analysed, hasPlan, slipped, stale, replanned, booked } = facts;
  useEffect(() => {
    if (!starting && !s.busy && !s.error) send({ type: "observe", facts: { analysed, hasPlan, slipped, stale, replanned, booked } });
  }, [analysed, hasPlan, slipped, stale, replanned, booked, starting, s.busy, s.error]);
  useEffect(() => {
    if (s.booked && !starting && !resetLock.current && receiptId !== s.booked.receipt.id) {
      const id = s.booked.receipt.id;
      editTourUrl(p => p.set("receipt", id));
    }
  }, [s.booked, starting, receiptId]);

  useEffect(() => {
    if (retrySample.current && s.message === retrySample.current && !s.busy) {
      retrySample.current = null;
      document.querySelector<HTMLButtonElement>(".analyse-action")?.click();
    }
  }, [s.message, s.busy]);
  const busy = starting || !!s.busy;
  const error = degraded && !receipt ? copy.degraded : s.error ? deskError(s.error.api.code)
    : !busy && needsReset ? c.resetPending
    : !busy && receiptId && !receipt ? c.missingReceipt
    : !busy && !receipt && ((!s.message.trim() && step === 1) || s.interpretation?.outcome === "clarification" || s.interpretation?.outcome === "ignore") ? c.clarify
    : !busy && !receipt && step > 1 && !s.plan ? c.retryState
    : !busy && !receipt && stale && (step < 6 || step === 8 || !slipped) ? c.retryState
    : !busy && !receipt && ((step === 7 && !stale && !replanned) || (step === 6 && ((slipped && !stale) || !s.stock?.scenario.demo_events.some(e => e.id === "b-slips-1430")))) ? c.retryState
    : !busy && !receipt && step === 8 && !s.plan?.joint.lines.length ? c.noRows
    : !busy && !receipt && (!!screen.action && unavailableAction === actionKey || step === 8 && !s.plannedInput) ? c.retryState : undefined;

  function retry() {
    if (busy) return;
    setUnavailableAction("");
    if (degraded) { window.dispatchEvent(new Event("focus")); return; }
    if (needsReset) { void restart(); return; }
    if (receiptId && !receipt) { void desk.refresh(); return; }
    if (s.error?.operation === "reset" || s.error?.operation === "load") { void restart(); return; }
    if (s.confirmation && s.error?.operation === "book") { void desk.book(); return; }
    if (s.error?.operation === "event" && slipped && stale) { void desk.refresh(); return; }
    if (s.error) { void desk.retry(); return; }
    if (error === c.clarify) {
      const sample = s.stock?.scenario.sample_messages[0]?.text;
      if (sample && s.message !== sample) {
        retrySample.current = sample; send({ type: "start" }); desk.edit(sample); return;
      }
    }
    if (s.stale && desk.incident) { send({ type: slipped ? "recover" : "start" }); void desk.replan(); return; }
    if (slipped && desk.incident && !s.stale && (step === 6 || step === 7 || step === 8)) {
      send({ type: "recover" }); void desk.replan(); return;
    }
    if (step !== 1) send({ type: "start" });
    void desk.analyse();
  }

  function back() {
    if (!busy && !finished && !s.confirmation && !(restored && !s.plan)) send({ type: "back", facts });
  }
  function forward(perform: boolean) {
    if (busy) return;
    if (error) { retry(); return; }
    if (finished) { leave(); return; }
    if (step === 8 && receipt) { setFinished(true); return; }
    if (current.step < current.furthest || !screen.action) { send({ type: "next", facts }); return; }
    const control = document.querySelector<HTMLButtonElement>(screen.action);
    if (control && !control.disabled) {
      if (perform) control.click();
      else control.focus();
    } else setUnavailableAction(actionKey);
  }
  if (!since) return null;
  const phase = finished ? "finish" : error ? "recovery" : step === 8 && receipt ? "receipt" : s.confirmation ? "confirm" : "step";
  return <TourOverlay step={step} target={screen.target} body={screen.body} error={error} host={s.confirmation ? host : null}
    busy={busy} phase={phase} notes={params.get("notes") === "1"} since={since} finished={finished} receipt={step === 8 && !!receipt}
    backDisabled={step === 1 || !!s.confirmation || !!restored && !s.plan} action={screen.action}
    back={back} next={() => forward(false)} act={() => forward(true)} exit={leave} retry={retry}
    restart={() => { void restart(); }} resetFinish={() => { void restart(true); }} />;
}
