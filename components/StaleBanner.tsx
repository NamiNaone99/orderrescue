import { useEffect, useRef } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { copy } from "@/lib/copy";
import type { DeskApiError } from "@/lib/client/api";
import type { PlanChange } from "@/lib/client/plan-changes";
import { formatBangkokTime } from "@/lib/domain/time";

function describe(change: PlanChange) {
  if (change.kind === "order") {
    const status = change.status === "reserved" ? copy.booked : change.status === "needs_human" ? copy.needsHuman : copy.missingRow;
    return "#" + change.id + " · " + status.th;
  }
  const row = copy.warehouse.th + " " + change.warehouse;
  if (change.oldReady && change.newReady && change.oldReady !== change.newReady) {
    return row + " · " + copy.readyTime.th + " " + formatBangkokTime(change.oldReady) + " → " + formatBangkokTime(change.newReady);
  }
  return row + " · " + change.sku + " · " + copy.revision.th + " " + change.before + " → " + (change.after ?? copy.missingRow.th);
}

export function StaleBanner({ changes, refusal, pending, replan }: {
  changes: PlanChange[]; refusal?: DeskApiError; pending: boolean; replan: () => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => { button.current?.focus(); }, []);
  const reason = refusal?.code === "IDEMPOTENCY_CONFLICT" ? copy.keyConflict : refusal?.code === "ORDER_ALREADY_RESERVED" ? copy.orderReserved : copy.stockChanged;
  return <section className="stale-banner" aria-labelledby="stale-heading"><TriangleAlert aria-hidden />
    <div><h2 id="stale-heading">{refusal ? copy.bookingRefused.th : copy.stockChanged.th}</h2>
      {refusal && <p>{reason.th}</p>}
      {changes.length > 0 && <ul>{changes.map(change => <li key={change.kind === "order" ? "#" + change.id : change.warehouse + "/" + change.sku}>{describe(change)}</li>)}</ul>}
      {refusal?.requestId && <small>{copy.requestId.th} {refusal.requestId.slice(0,8)}</small>}</div>
    <button id="stale-replan" ref={button} type="button" className="outline-action" disabled={pending} onClick={replan}><RefreshCw />{copy.replan.th}</button>
  </section>;
}
