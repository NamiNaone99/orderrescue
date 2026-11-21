import { useEffect, useRef, useState, type FormEvent } from "react";
import { ClipboardPenLine } from "lucide-react";
import { copy } from "@/lib/copy";
import type { PlanRequest, StateResponse } from "@/lib/domain/contracts";
import { bangkokTimestamp, formatBangkokTime } from "@/lib/domain/time";

type ManualIncident = PlanRequest["incident"];
const clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function ManualIncidentForm({ stock, skus, previous, budgetValid, submit, cancel }: {
  stock: StateResponse; skus: StateResponse["skus"]; previous: ManualIncident | null;
  budgetValid: boolean; submit: (incident: ManualIncident) => void; cancel: () => void;
}) {
  const [warehouse, setWarehouse] = useState<string>(previous?.warehouse_id ?? "");
  const [sku, setSku] = useState(previous?.sku_id ?? "");
  const [start, setStart] = useState(previous ? formatBangkokTime(previous.window_start) : "");
  const [end, setEnd] = useState(previous ? formatBangkokTime(previous.window_end) : "");
  const [submitted, setSubmitted] = useState(false);
  const first = useRef<HTMLSelectElement>(null);
  useEffect(() => { first.current?.focus(); }, []);
  const selected = stock.warehouses.find(item => item.id === warehouse);
  const product = skus.find(item => item.id === sku.trim());
  const errors = {
    warehouse: selected ? "" : copy.manualWarehouse.th,
    sku: product ? "" : copy.manualSku.th,
    start: clock.test(start) ? "" : copy.missingTime.th,
    end: !clock.test(end) ? copy.missingTime.th : end <= start ? copy.invalidWindow.th : "",
  };
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    const invalid = Object.entries(errors).find(([, message]) => message);
    if (invalid) {
      event.currentTarget.querySelector<HTMLElement>("[name=" + invalid[0] + "]")?.focus();
      return;
    }
    if (!selected || !product || !budgetValid) return;
    const date = stock.scenario.now_at.slice(0, 10);
    submit({ warehouse_id: selected.id, sku_id: product.id, window_start: bangkokTimestamp(date, start), window_end: bangkokTimestamp(date, end) });
  }
  function field(name: keyof typeof errors) {
    const invalid = submitted && !!errors[name];
    return { name, id: "manual-" + name, "aria-invalid": invalid, "aria-describedby": invalid ? "manual-error-" + name : undefined };
  }
  function issue(name: keyof typeof errors) {
    return submitted && errors[name] && <small className="danger-note" id={"manual-error-" + name}>{errors[name]}</small>;
  }
  return <form id="manual-incident" className="desk-panel manual-form" aria-labelledby="manual-heading" onSubmit={send} noValidate>
    <div className="panel-heading"><span className="panel-icon"><ClipboardPenLine aria-hidden /></span>
      <div><h2 id="manual-heading">{copy.manualEntry.th}</h2><span lang="en">{copy.manualEntry.en}</span></div></div>
    <p>{copy.manualHint.th}</p>
    <div><label htmlFor="manual-warehouse">{copy.warehouse.th}</label>
      <select {...field("warehouse")} ref={first} value={warehouse} onChange={e => setWarehouse(e.target.value)} required>
        <option value="">{copy.manualWarehouse.th}</option>
        {stock.warehouses.map(w => <option key={w.id} value={w.id}>{w.name_th}</option>)}</select>{issue("warehouse")}</div>
    <div><label htmlFor="manual-sku">{copy.item.th} (SKU)</label>
      <input {...field("sku")} list="manual-skus" value={sku} autoComplete="off" required onChange={e => setSku(e.target.value)} />
      <datalist id="manual-skus">{skus.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</datalist>{issue("sku")}</div>
    <div className="manual-times"><div><label htmlFor="manual-start">{copy.windowStart.th}</label>
      <input {...field("start")} type="time" step={60} value={start} required onChange={e => setStart(e.target.value)} />{issue("start")}</div>
      <div><label htmlFor="manual-end">{copy.windowEnd.th}</label>
        <input {...field("end")} type="time" step={60} value={end} required onChange={e => setEnd(e.target.value)} />{issue("end")}</div></div>
    {!budgetValid && <p className="danger-note">{copy.budgetInvalid.th}</p>}
    <div className="manual-actions"><button className="primary-action" type="submit" disabled={!budgetValid}>{copy.manualPlan.th}</button>
      <button type="button" className="outline-action" onClick={cancel}>{copy.cancel.th}</button></div>
  </form>;
}
