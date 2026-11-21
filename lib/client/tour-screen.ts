import { copy, tourCopy as c } from "@/lib/copy";
import type { PlanResponse, StateResponse } from "@/lib/domain/contracts";
import { formatBangkokTime } from "@/lib/domain/time";
import { formatThb } from "@/lib/domain/money";
import type { useDesk } from "./use-desk";
import type { TourFacts } from "./tour";

export type Desk = ReturnType<typeof useDesk>;
export type SavedReceipt = StateResponse["reservations"][number];
type Pair = { th: string; en: string };
export function words(pair: Pair, values: Record<string, string> = {}): Pair {
  const fill = (text: string) => text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
  return { th: fill(pair.th), en: fill(pair.en) };
}

function sources(plan: PlanResponse) {
  return plan.joint.lines.slice(0, 2).map(row => "#" + row.order_id + "/" + row.warehouse_id).join(", ") || "—";
}
export function tourFacts(desk: Desk, receipt?: SavedReceipt): TourFacts {
  const { s } = desk;
  const slipped = !!s.stock?.scenario.demo_events.find(event => event.id === "b-slips-1430")?.applied;
  return { analysed: !!desk.incident, hasPlan: !!s.plan, slipped, stale: !!s.stale, booked: !!receipt,
    replanned: slipped && !s.stale && !!s.plannedInput && !!s.plan &&
      !!s.baseline?.scenario.demo_events.find(event => event.id === "b-slips-1430")?.applied };
}

export function tourScreen(step: number, desk: Desk, facts: TourFacts, receipt: SavedReceipt | undefined, finished: boolean) {
  const { s } = desk, plan = s.plan;
  const humanOrders = plan?.joint.needs_human.slice(0, 2).map(row => "#" + row.order_id).join(", ") || "—";
  const screen = (target: string, body: Pair, action?: string) => ({ target, body, action });
  switch (step) {
    case 1: return screen(".message-panel", words(c.message, { sku: s.stock?.scenario.default_sku_id ?? "" }), ".analyse-action");
    case 2: {
      const it = desk.incident;
      return screen("#desk-incident", it ? words(c.incident, { wh: it.warehouse_id, sku: s.sku,
        time: formatBangkokTime(it.window_start) + "–" + formatBangkokTime(it.window_end) }) : c.waiting);
    }
    case 3: return screen(".orders", plan ? words(c.orders, { orders: [...plan.affected].sort((a, b) => a.deadline_at.localeCompare(b.deadline_at)).slice(0, 2)
      .map(row => "#" + row.order_id + " · " + formatBangkokTime(row.deadline_at)).join(" / ") || "—" }) : c.waiting);
    case 4: {
      const first = plan?.first_come;
      const line = first?.lines[0], human = first?.needs_human[0];
      const why = line && human ? words(c.firstWhy, { wh: line.warehouse_id, served: line.order_id, missed: human.order_id }).th : "";
      return screen(".strategy.baseline", first ? words(c.first, { score: first.on_time + "/" + first.total, cost: formatThb(first.extra_cost_thb), why }) : c.waiting);
    }
    case 5: return screen(".strategy.joint", plan ? words(c.joint, { score: plan.joint.on_time + "/" + plan.joint.total,
      cost: formatThb(plan.joint.extra_cost_thb), budget: formatThb(plan.budget_thb), gain: String(plan.joint.on_time - plan.first_come.on_time) }) : c.waiting);
    case 6: {
      const slip = s.stock?.scenario.demo_events.find(event => event.id === "b-slips-1430");
      return screen(".demo-events", words(c.delay, { event: slip?.label_th ?? copy.demoEvents.th }), '[data-event-id="b-slips-1430"]');
    }
    case 7: return facts.stale ? screen(".stale-banner", c.stale, "#stale-replan")
      : screen(".strategy.joint", plan ? words(c.replanned, { score: plan.joint.on_time + "/" + plan.joint.total,
        served: sources(plan), human: humanOrders }) : c.waiting);
    default: {
      if (receipt) {
        const line = receipt.lines.find(row => row.sku_id === desk.stockSku);
        const stock = s.stock?.stock.find(row => row.warehouse_id === line?.warehouse_id && row.sku_id === line.sku_id);
        if (!finished && (!line || !stock || stock.revision <= line.expected_revision)) return screen("#desk-receipt", words(c.receiptPending, { ref: receipt.id.slice(0, 8) }));
        return screen("#desk-receipt", finished ? c.done : words(c.receipt, { ref: receipt.id.slice(0, 8),
          stock: stock ? words(c.free, { wh: stock.warehouse_id, qty: String(stock.free) }).th : "" }));
      }
      if (s.confirmation) return screen(".confirm-popup .booking-table", c.confirm, ".confirm-popup .dialog-actions .primary-action");
      return screen(".budget-panel", plan ? words(c.review, { served: sources(plan), human: humanOrders, cost: formatThb(plan.joint.extra_cost_thb) }) : c.waiting,
        ".confirm-slot button");
    }
  }
}
