"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { InterpretResponse, PlanRequest, PlanResponse, ReservationRequest, ReservationResponse, StateResponse } from "@/lib/domain/contracts";
import type { ScenarioId } from "@/lib/domain/types";
import { api, DeskApiError } from "./api";
import { planChanges, type PlanChange } from "./plan-changes";

type Operation = "load" | "interpret" | "plan" | "book" | "reset" | "refresh" | "event";
type IncidentWindow = Pick<PlanRequest["incident"], "warehouse_id" | "window_start" | "window_end">;
type DispatchState = {
  stock: StateResponse | null; catalog: StateResponse["skus"]; message: string; evidenceMessage: string;
  interpretation: InterpretResponse | null; manualIncident: PlanRequest["incident"] | null; sku: string; budget: string;
  plan: PlanResponse | null; plannedInput: PlanRequest | null; confirmation: ReservationRequest | null;
  baseline: StateResponse | null; stale: { changes: PlanChange[]; refusal?: DeskApiError } | null;
  booked: ReservationResponse | null; busy: Operation | null; error: { operation: Operation; api: DeskApiError } | null;
};
const initial: DispatchState = {
  stock: null, catalog: [], message: "", evidenceMessage: "", interpretation: null, manualIncident: null, sku: "", budget: "",
  plan: null, plannedInput: null, confirmation: null, baseline: null, stale: null, booked: null, busy: "load", error: null,
};
type Action =
  | { type: "begin"; op: Operation }
  | { type: "failed"; op: Operation; error: DeskApiError }
  | { type: "loaded"; stock: StateResponse; catalog: StateResponse["skus"] }
  | { type: "edit"; message: string }
  | { type: "interpreted"; answer: InterpretResponse; message: string; sku: string }
  | { type: "manual"; incident: PlanRequest["incident"] }
  | { type: "selection"; budget: string; sku: string }
  | { type: "planned"; plan: PlanResponse; input: PlanRequest; stock: StateResponse }
  | { type: "dialog"; confirmation: ReservationRequest | null }
  | { type: "booked"; result: ReservationResponse }
  | { type: "observed"; plan: PlanResponse; stock: StateResponse }
  | { type: "pollFailed"; plan: PlanResponse; error: DeskApiError }
  | { type: "refreshed"; stock: StateResponse };

function updateStock(s: DispatchState, stock: StateResponse): DispatchState {
  const next = { ...s, stock };
  if (!s.plan || !s.baseline || !s.plannedInput || s.booked) return next;
  // A transport or storage failure can hide a committed booking. Keep its request for replay.
  const ambiguous = s.confirmation && s.error?.operation === "book" &&
    (s.error.api.code === "INTERNAL" || s.error.api.code === "STORAGE_UNAVAILABLE");
  if (ambiguous) return next;
  const changes = planChanges(s.plan, s.baseline, stock);
  if (!changes.length) return next;
  return { ...next, confirmation: null, stale: { ...s.stale, changes } };
}

function reducer(s: DispatchState, a: Action): DispatchState {
  switch (a.type) {
    case "begin": return { ...s, busy: a.op, error: null };
    case "failed": {
      if (a.op === "book" && a.error.status === 409) {
        return { ...s, busy: null, confirmation: null, stale: { changes: s.stale?.changes ?? [], refusal: a.error }, error: null };
      }
      return { ...s, busy: null, error: { operation: a.op, api: a.error },
        confirmation: a.op === "book" && (a.error.status === 422 || a.error.status === 429) ? null : s.confirmation };
    }
    case "loaded": return { ...initial, stock: a.stock, catalog: a.catalog, busy: null,
      message: a.stock.scenario.sample_messages[0]?.text ?? "", budget: String(a.stock.scenario.default_budget_thb) };
    case "edit": return { ...s, message: a.message, interpretation: null, manualIncident: null, plan: null, plannedInput: null, baseline: null, stale: null, busy: null, error: null };
    case "interpreted": return { ...s, interpretation: a.answer, manualIncident: null, evidenceMessage: a.message, sku: a.sku,
      plan: null, plannedInput: null, baseline: null, stale: null, busy: null, error: null };
    case "manual": return { ...s, manualIncident: a.incident, interpretation: null, sku: a.incident.sku_id,
      plan: null, plannedInput: null, baseline: null, booked: null, confirmation: null, stale: null, busy: null, error: null };
    case "selection": return { ...s, budget: a.budget, sku: a.sku, plannedInput: null, busy: null, error: null };
    case "planned": return updateStock({ ...s, plan: a.plan, plannedInput: a.input, baseline: a.stock, stale: null, busy: null, error: null }, a.stock);
    case "dialog": return s.stale ? s : { ...s, confirmation: a.confirmation, error: null };
    case "booked": return { ...s, booked: a.result, confirmation: null, stale: null, error: null, busy: "refresh" };
    case "refreshed": return updateStock({ ...s, busy: null, error: null }, a.stock);
    case "observed": return s.plan !== a.plan || s.busy || !s.plannedInput ? s :
      updateStock({ ...s, error: s.error?.operation === "refresh" ? null : s.error }, a.stock);
    case "pollFailed": return s.plan !== a.plan || s.busy || s.error || !s.plannedInput ? s :
      { ...s, error: { operation: "refresh", api: a.error } };
  }
}

export function validBudget(value: string) {
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value));
}

export function useDesk(scenario: ScenarioId, defaults: Pick<StateResponse["scenario"], "sample_messages" | "default_budget_thb">) {
  const [s, dispatch] = useReducer(reducer, defaults, seed => ({
    ...initial, message: seed.sample_messages[0]?.text ?? "", budget: String(seed.default_budget_thb),
  }));
  const initialRead = useRef<Promise<boolean> | null>(null);
  const queuedAnalysis = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const lastEvent = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancel = useCallback(() => { clearTimeout(timer.current); pending.current?.abort(); }, []);
  const run = useCallback(async (op: Operation, work: (signal: AbortSignal, apply: (a: Action) => void) => Promise<void>) => {
    cancel();
    const controller = new AbortController();
    pending.current = controller;
    const apply = (action: Action) => { if (!controller.signal.aborted) dispatch(action); };
    apply({ type: "begin", op });
    try { await work(controller.signal, apply); }
    catch (err) {
      apply({ type: "failed", op, error: err instanceof DeskApiError ? err : new DeskApiError("INTERNAL", null, 0) });
    }
  }, [cancel]);
  const load = useCallback(async (reset: boolean) => {
    let ready = false;
    await run(reset ? "reset" : "load", async (signal, apply) => {
      if (reset && scenario === "hero") await api.reset({ scenario });
      const catalog = await api.state({ scenario }, signal);
      const sku = catalog.scenario.default_sku_id;
      const stock = catalog.skus.some(item => item.id === sku) ? catalog : await api.state({ scenario, sku }, signal);
      apply({ type: "loaded", stock, catalog: stock === catalog ? catalog.skus : [...catalog.skus, ...stock.skus] });
      ready = !signal.aborted;
    });
    return ready;
  }, [run, scenario]);
  const readInitial = useCallback(() => initialRead.current ??= load(false), [load]);
  useEffect(() => {
    void readInitial();
    return () => { cancel(); initialRead.current = null; };
  }, [readInitial, cancel]);

  useEffect(() => {
    const plan = s.plan;
    const input = s.plannedInput;
    if (!plan || !input || s.busy) return;
    let inFlight: AbortController | null = null;
    let interval: ReturnType<typeof setInterval> | undefined;
    async function read() {
      if (!plan || !input || document.hidden || inFlight) return;
      const controller = new AbortController();
      inFlight = controller;
      try {
        const stock = await api.state({ scenario, sku: input.incident.sku_id }, controller.signal);
        if (!controller.signal.aborted) dispatch({ type: "observed", plan, stock });
      } catch (error) {
        if (!controller.signal.aborted && error instanceof DeskApiError) dispatch({ type: "pollFailed", plan, error });
      } finally { if (inFlight === controller) inFlight = null; }
    }
    function stop() { clearInterval(interval); inFlight?.abort(); inFlight = null; }
    function syncVisibility() {
      stop();
      if (!document.hidden) {
        void read();
        interval = setInterval(() => { void read(); }, 5000);
      }
    }
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", syncVisibility); };
  }, [s.plan, s.plannedInput, s.busy, s.confirmation, scenario]);

  const incident = s.manualIncident ?? s.interpretation?.incident;
  function makePlan(incident: IncidentWindow, sku: string, budget: string) {
    if (!sku || !validBudget(budget)) return;
    const input: PlanRequest = { scenario, budget_thb: Number(budget), incident: { warehouse_id: incident.warehouse_id, sku_id: sku,
      window_start: incident.window_start, window_end: incident.window_end } };
    return run("plan", async (signal, apply) => {
      const plan = await api.plan(input, signal);
      const stock = await api.state({ scenario, sku }, signal);
      apply({ type: "planned", plan, input, stock });
    });
  }
  function planManually(entered: PlanRequest["incident"]) {
    if (s.confirmation || s.busy === "book" || s.busy === "reset" || s.busy === "event") return;
    cancel();
    dispatch({ type: "manual", incident: entered });
    return makePlan(entered, entered.sku_id, s.budget);
  }
  async function analyse() {
    if (s.stale || queuedAnalysis.current) return;
    if (!s.stock) {
      queuedAnalysis.current = true;
      const read = readInitial();
      dispatch({ type: "begin", op: "interpret" });
      const ready = await read;
      queuedAnalysis.current = false;
      if (!ready || pending.current?.signal.aborted) return;
    }
    return run("interpret", async (signal, apply) => {
      const answer = await api.interpret({ scenario, message: s.message }, signal);
      const ids = answer.incident?.sku_ids ?? [];
      const sku = ids.includes(s.sku) ? s.sku : ids.length === 1 ? ids[0] : "";
      apply({ type: "interpreted", answer, message: s.message, sku });
      if (signal.aborted) return;
      if (answer.incident && sku && validBudget(s.budget)) await makePlan(answer.incident, sku, s.budget);
      else {
        const stock = await api.state({ scenario, sku: sku || s.stock?.scenario.default_sku_id }, signal);
        apply({ type: "refreshed", stock });
      }
    });
  }
  function edit(message: string) {
    cancel();
    dispatch({ type: "edit", message });
  }
  function select(sku: string, budget: string, debounce = false) {
    if (s.stale) return;
    cancel();
    dispatch({ type: "selection", sku, budget });
    if (!incident || !validBudget(budget)) return;
    if (debounce) timer.current = setTimeout(() => { void makePlan(incident, sku, budget); }, 300);
    else void makePlan(incident, sku, budget);
  }
  function openDialog() {
    if (!s.plan?.joint.lines.length || !s.plannedInput || s.busy || s.booked || s.error || s.stale) return;
    const lines = s.plan.joint.lines.map(({ order_id, sku_id, warehouse_id, qty, unit_cost_thb, expected_revision }) =>
      ({ order_id, sku_id, warehouse_id, qty, unit_cost_thb, expected_revision }));
    dispatch({ type: "dialog", confirmation: { ...s.plannedInput, lines, plan_hash: s.plan.plan_hash, idempotency_key: crypto.randomUUID() } });
  }
  function refresh() {
    return run("refresh", async (signal, apply) => {
      const stock = await api.state({ scenario, sku: s.sku || s.stock?.scenario.default_sku_id }, signal);
      apply({ type: "refreshed", stock });
    });
  }
  function applyEvent(id: string) {
    lastEvent.current = id;
    return run("event", async (signal, apply) => {
      await api.event({ scenario, event_id: id }, signal);
      const stock = await api.state({ scenario, sku: s.sku || s.stock?.scenario.default_sku_id }, signal);
      apply({ type: "refreshed", stock });
    });
  }
  function replan() {
    if (incident) return makePlan(incident, s.sku, s.budget);
  }
  const bookingActive = useRef(false);
  async function book() {
    const input = s.confirmation;
    if (!input || s.stale || bookingActive.current) return;
    bookingActive.current = true;
    try {
      await run("book", async (signal, apply) => {
        const result = await api.reserve(input, signal);
        apply({ type: "booked", result });
        if (!signal.aborted) await refresh();
      });
    } finally { bookingActive.current = false; }
  }
  function retry() {
    switch (s.error?.operation) {
      case "load": return load(false);
      case "reset": return load(true);
      case "refresh": return refresh();
      case "interpret": return analyse();
      case "event": if (lastEvent.current) return applyEvent(lastEvent.current); break;
      case "plan": case "book":
        if (incident) {
          dispatch({ type: "dialog", confirmation: null });
          return makePlan(incident, s.sku, s.budget);
        }
    }
  }
  return { s, incident, edit, select, analyse, planManually, retry, book, openDialog, applyEvent, replan,
    closeDialog: () => dispatch({ type: "dialog", confirmation: null }), startAgain: () => load(true) };
}
