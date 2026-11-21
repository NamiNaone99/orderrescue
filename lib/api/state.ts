import "server-only";
import type { StateResponse } from "@/lib/domain/contracts";
import type { StoreSnapshot } from "@/lib/store/types";

export function publicState(snapshot: StoreSnapshot): StateResponse {
  const { scenario, warehouses, skus, stock, orders, order_lines, reservations, state_version } = snapshot;
  const linesByOrder = Map.groupBy(order_lines, line => line.order_id);
  return {
    scenario: {
      id: scenario.id,
      name_th: scenario.name_th,
      name_en: scenario.name_en,
      kind: scenario.kind,
      now_at: scenario.now_at,
      default_budget_thb: scenario.default_budget_thb,
      default_sku_id: scenario.default_sku_id,
      shifts: scenario.shifts.map(({ name_th, start, end }) => ({ name_th, start, end })),
      demo_events: scenario.demo_events.map(({ id, label_th, label_en, applied }) => ({ id, label_th, label_en, applied })),
      sample_messages: scenario.sample_messages.map(({ text, label_th }) => ({ text, label_th })),
    },
    warehouses: warehouses.map(({ id, name_th, is_home }) => ({ id, name_th, is_home })),
    skus: skus.map(({ id, name }) => ({ id, name })),
    stock: stock.map(({ warehouse_id, sku_id, on_hand, committed, ready_at, extra_cost_per_unit_thb, revision }) => ({
      warehouse_id, sku_id, on_hand, committed, free: on_hand - committed, ready_at, extra_cost_per_unit_thb, revision,
    })),
    orders: orders.map(({ id, received_at, deadline_at, home_warehouse_id, status }) => ({
      id, received_at, deadline_at, home_warehouse_id, status,
      lines: (linesByOrder.get(id) ?? []).map(({ sku_id, qty }) => ({ sku_id, qty })),
    })),
    reservations: reservations.map(({ id, created_at, total_extra_cost_thb, lines }) => ({
      id, created_at, total_extra_cost_thb,
      lines: lines.map(({ order_id, sku_id, warehouse_id, qty, unit_cost_thb, expected_revision }) => ({
        order_id, sku_id, warehouse_id, qty, unit_cost_thb, expected_revision,
      })),
    })),
    state_version,
  };
}
