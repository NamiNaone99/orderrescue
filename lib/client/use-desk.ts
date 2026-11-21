"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { InterpretResponse, PlanRequest, PlanResponse, ReservationRequest, ReservationResponse, StateResponse } from "@/lib/domain/contracts";
import type { ScenarioId } from "@/lib/domain/types";
import { api, DeskApiError } from "./api";

type Operation = "load" | "interpret" | "plan" | "book" | "reset" | "refresh";
type Incident = Extract<InterpretResponse, { outcome: "incident" }>["incident"];
type DispatchState = {
  stock: StateResponse | null; catalog: StateResponse["skus"]; message: string; evidenceMessage: string;
  interpretation: InterpretResponse | null; sku: string; budget: string;
  plan: PlanResponse | null; plannedInput: PlanRequest | null; confirmation: ReservationRequest | null;
  booked: ReservationResponse | null; busy: Operation | null; error: { operation: Operation; api: DeskApiError } | null;
};
const initial: DispatchState = {
  stock: null, catalog: [], message: "", evidenceMessage: "", interpretation: null, sku: "", budget: "",
  plan: null, plannedInput: null, confirmation: null, booked: null, busy: "load", error: null,
};
type Action =
  | { type: "begin"; op: Operation }
  | { type: "failed"; op: Operation; error: DeskApiError }
  | { type: "loaded"; stock: StateResponse; catalog: StateResponse["skus"] }
  | { type: "edit"; message: string }
  | { type: "interpreted"; answer: InterpretResponse; message: string; sku: string }
  | { type: "selection"; budget: string; sku: string }
  | { type: "planned"; plan: PlanResponse; input: PlanRequest; stock: StateResponse }
  | { type: "dialog"; confirmation: ReservationRequest | null }
  | { type: "booked"; result: ReservationResponse }
  | { type: "refreshed"; stock: StateResponse };

function reducer(s: DispatchState, a: Action): DispatchState {
  switch (a.type) {
    case "begin": return { ...s, busy: a.op, error: null };
    case "failed": return { ...s, busy: null, error: { operation: a.op, api: a.error },
      confirmation: a.op === "book" && [409, 422].includes(a.error.status) ? null : s.confirmation };
    case "loaded": return { ...initial, stock: a.stock, catalog: a.catalog, busy: null,
      message: a.stock.scenario.sample_messages[0]?.text ?? "", budget: String(a.stock.scenario.default_budget_thb) };
    case "edit": return { ...s, message: a.message, interpretation: null, plan: null, plannedInput: null, busy: null, error: null };
    case "interpreted": return { ...s, interpretation: a.answer, evidenceMessage: a.message, sku: a.sku,
      plan: null, plannedInput: null, busy: null, error: null };
    case "selection": return { ...s, budget: a.budget, sku: a.sku, plannedInput: null, busy: null, error: null };
    case "planned": return { ...s, plan: a.plan, plannedInput: a.input, stock: a.stock, busy: null, error: null };
    case "dialog": return { ...s, confirmation: a.confirmation, error: null };
    case "booked": return { ...s, booked: a.result, confirmation: null, error: null, busy: "refresh" };
    case "refreshed": return { ...s, stock: a.stock, busy: null, error: null };
  }
}

export function validBudget(value: string) {
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value));
}

export function useDesk(scenario: ScenarioId) {
  const [s, dispatch] = useReducer(reducer, initial);
  const pending = useRef<AbortController | null>(null);
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
  const load = useCallback((reset: boolean) => run(reset ? "reset" : "load", async (signal, apply) => {
    if (reset && scenario === "hero") await api.reset({ scenario });
    const catalog = await api.state({ scenario }, signal);
    const sku = catalog.scenario.default_sku_id;
    const stock = catalog.skus.some(item => item.id === sku) ? catalog : await api.state({ scenario, sku }, signal);
    apply({ type: "loaded", stock, catalog: catalog.skus });
  }), [run, scenario]);
  useEffect(() => { void load(false); return cancel; }, [load, cancel]);

  function makePlan(incident: Incident, sku: string, budget: string) {
    if (!sku || !validBudget(budget)) return;
    const input: PlanRequest = { scenario, budget_thb: Number(budget), incident: { warehouse_id: incident.warehouse_id, sku_id: sku,
      window_start: incident.window_start, window_end: incident.window_end } };
    return run("plan", async (signal, apply) => {
      const [plan, stock] = await Promise.all([api.plan(input, signal), api.state({ scenario, sku }, signal)]);
      apply({ type: "planned", plan, input, stock });
    });
  }
  function analyse() {
    return run("interpret", async (signal, apply) => {
      const answer = await api.interpret({ scenario, message: s.message }, signal);
      const ids = answer.incident?.sku_ids ?? [];
      const sku = ids.includes(s.sku) ? s.sku : ids.length === 1 ? ids[0] : "";
      apply({ type: "interpreted", answer, message: s.message, sku });
      if (!signal.aborted && answer.incident) await makePlan(answer.incident, sku, s.budget);
    });
  }
  function edit(message: string) {
    cancel();
    dispatch({ type: "edit", message });
  }
  function select(sku: string, budget: string, debounce = false) {
    cancel();
    dispatch({ type: "selection", sku, budget });
    const incident = s.interpretation?.incident;
    if (!incident || !validBudget(budget)) return;
    if (debounce) timer.current = setTimeout(() => { void makePlan(incident, sku, budget); }, 300);
    else void makePlan(incident, sku, budget);
  }
  function openDialog() {
    if (!s.plan?.joint.lines.length || !s.plannedInput || s.busy || s.booked || s.error) return;
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
  const bookingActive = useRef(false);
  async function book() {
    const input = s.confirmation;
    if (!input || bookingActive.current) return;
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
      case "plan": case "book":
        if (s.interpretation?.incident) {
          dispatch({ type: "dialog", confirmation: null });
          return makePlan(s.interpretation.incident, s.sku, s.budget);
        }
    }
  }
  return { s, edit, select, analyse, retry, book, openDialog,
    closeDialog: () => dispatch({ type: "dialog", confirmation: null }), startAgain: () => load(true) };
}
