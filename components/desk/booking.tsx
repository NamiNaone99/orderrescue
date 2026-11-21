import { useState } from "react";
import { Check, CircleAlert, Copy, LoaderCircle, RotateCcw, TicketCheck } from "lucide-react";
import { copy } from "@/lib/copy";
import { DeskApiError } from "@/lib/client/api";
import type { PlanResponse, ReservationRequest, ReservationResponse } from "@/lib/domain/contracts";
import { formatThb } from "@/lib/domain/money";
import { formatBangkokTime } from "@/lib/domain/time";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const errors = { INVALID_INPUT: copy.invalidInput, RATE_LIMITED: copy.limited, PLAN_HASH_MISMATCH: copy.badHash,
  OVER_BUDGET: copy.overBudget, STALE_STOCK: copy.stockChanged, ORDER_ALREADY_RESERVED: copy.orderReserved,
  IDEMPOTENCY_CONFLICT: copy.reopen, STORAGE_UNAVAILABLE: copy.degraded, INTERNAL: copy.requestFailed, UNAUTHORIZED: copy.unauthorized };

export function ErrorNotice({ error, retry, booking = false }: { error: DeskApiError; retry?: () => void; booking?: boolean }) {
  return <div className="desk-error" role="alert"><CircleAlert /><div><strong>{booking ? copy.bookingRefused.th : copy.error.th}</strong>
    <p>{errors[error.code].th}</p>{error.requestId && <small title={error.requestId}>{copy.requestId.th} {error.requestId.slice(0,8)}</small>}
    {retry && <button className="text-action" onClick={retry}>{booking ? copy.replan.th : copy.tryAgain.th}</button>}</div></div>;
}

function BookingLines({ lines }: { lines: ReservationRequest["lines"] }) {
  return <table className="booking-table"><thead><tr>{[copy.order,copy.item,copy.assign,copy.quantity,copy.unitCost,copy.revision].map(label =>
    <th key={label.en} scope="col">{label.th}</th>)}</tr></thead><tbody>{lines.map(row =>
      <tr key={row.order_id + "/" + row.sku_id}><th scope="row">#{row.order_id}</th><td>{row.sku_id}</td>
        <td><b>{copy.warehouse.th} {row.warehouse_id}</b></td><td>{row.qty}</td><td>{formatThb(row.unit_cost_thb)}</td><td>r{row.expected_revision}</td></tr>)}</tbody></table>;
}

export function ConfirmDialog({ input, plan, busy, degraded, error, cancel, book, replan }: {
  input: ReservationRequest | null; plan: PlanResponse | null; busy: boolean; degraded: boolean; error: DeskApiError | null;
  cancel: () => void; book: () => void; replan: () => void;
}) {
  const refused = !!error && !["INTERNAL", "RATE_LIMITED", "STORAGE_UNAVAILABLE"].includes(error.code);
  return <Dialog open={!!input} onOpenChange={open => { if (!open && !busy) cancel(); }}>
    <DialogContent showCloseButton={false} className="confirm-popup" aria-busy={busy}
      finalFocus={() => document.getElementById("desk-receipt") ?? document.getElementById("stale-replan") ?? document.querySelector<HTMLButtonElement>(".budget-bottom button")}>
      <DialogHeader><div className="panel-icon"><TicketCheck /></div><DialogTitle className="dialog-title">{copy.confirmTitle.th}</DialogTitle>
        <DialogDescription>{copy.exact.th}</DialogDescription></DialogHeader>
      {input && plan && <><BookingLines lines={input.lines} /><div className="total-line"><span>{copy.total.th}</span><b>{formatThb(plan.joint.extra_cost_thb)}</b></div>
        {plan.joint.needs_human.length > 0 && <p>{copy.needsHuman.th} {plan.joint.needs_human.map(x => "#" + x.order_id).join(", ")}</p>}</>}
      {error && <ErrorNotice booking={refused} error={error} />}
      {degraded && <p role="status" className="danger-note">{copy.degraded.th}</p>}
      <div className="dialog-actions"><button className="outline-action" disabled={busy} onClick={cancel}>{copy.cancel.th}</button>
        <button className="primary-action" disabled={busy || (degraded && !refused)} onClick={refused ? replan : book}>
          {busy ? <LoaderCircle className="spin" /> : <Check />}{busy ? copy.booking.th : refused ? copy.replan.th : copy.confirm.th}</button></div>
    </DialogContent>
  </Dialog>;
}

export function Receipt({ result, plan, newIncident, busy }: { result: ReservationResponse; plan: PlanResponse;
  newIncident: () => void; busy: boolean }) {
  const { receipt } = result;
  const [notice, setNotice] = useState("");
  async function copyText() {
    const plain = [copy.receipt.th + " " + receipt.id, ...receipt.lines.map(row =>
      "#" + row.order_id + " · " + row.sku_id + " · " + copy.warehouse.th + " " + row.warehouse_id + " × " + row.qty),
      copy.total.th + " " + formatThb(receipt.total_extra_cost_thb)].join("\n");
    try { await navigator.clipboard.writeText(plain); setNotice(copy.copied.th); }
    catch { setNotice(copy.copyFailed.th); }
  }
  return <section id="desk-receipt" className="desk-panel receipt-panel" tabIndex={0} aria-labelledby="receipt-heading">
    <div className="panel-heading"><span className="panel-icon"><TicketCheck /></span><div><h2 id="receipt-heading">{copy.receipt.th}</h2><span lang="en">{copy.receipt.en}</span></div>
      <span className="receipt-badge"><Check />{copy.booked.th}</span></div>
    <div className="receipt-meta"><span title={receipt.id}>{copy.receiptId.th} <b>{receipt.id.slice(0,8)}</b></span>
      <span>{copy.time.th} <b>{formatBangkokTime(receipt.created_at)}</b></span><span title={receipt.idempotency_key}>{copy.replayKey.th} <b>{receipt.idempotency_key.slice(0,8)}</b></span></div>
    <BookingLines lines={receipt.lines} /><div className="total-line"><span>{copy.total.th}</span><b>{formatThb(receipt.total_extra_cost_thb)}</b></div>
    {result.replayed && <p>{copy.replayed.th}</p>}
    {plan.joint.needs_human.length > 0 && <p>{copy.needsHuman.th} {plan.joint.needs_human.map(o => "#" + o.order_id).join(", ")}</p>}
    <div className="receipt-actions"><button className="outline-action" onClick={copyText}><Copy />{copy.copyReceipt.th}</button><small role="status">{notice}</small>
      <button className="primary-action" disabled={busy} onClick={newIncident}><RotateCcw />{copy.newIncident.th}</button></div>
  </section>;
}
