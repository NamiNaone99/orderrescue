import "server-only";
import type { PlanRequest, PlanResponse, ReservationRequest } from "@/lib/domain/contracts";
import { ApiError } from "@/lib/http";
import { plan } from "@/lib/planner";
import { findAffected } from "@/lib/planner/affected";
import { planHash } from "@/lib/planner/hash";
import { getStore } from "@/lib/store";

export async function createPlan({ scenario, incident, budget_thb }: PlanRequest): Promise<PlanResponse> {
  const snapshot = await getStore().getSnapshot(scenario, { sku: incident.sku_id });
  if (!snapshot.skus.some(sku => sku.id === incident.sku_id)
    || !snapshot.warehouses.some(warehouse => warehouse.id === incident.warehouse_id)) {
    throw new ApiError("INVALID_INPUT");
  }
  if (snapshot.orders.length > 60 && findAffected(snapshot, incident).length > 60) {
    throw new ApiError("INVALID_INPUT");
  }
  const resumed = snapshot.resumptions?.filter(event => event.warehouse_id === incident.warehouse_id
    && event.sku_id === incident.sku_id && event.window_start === incident.window_start
    && event.window_end === incident.window_end).map(event => event.at).sort().at(0);
  const result = plan(snapshot, resumed ? { ...incident, window_end: resumed } : incident, budget_thb);
  const reportRevisions = snapshot.stock.flatMap(row => row.report_revision === undefined ? [] :
    [{ warehouse_id: row.warehouse_id, sku_id: row.sku_id, revision: row.report_revision }]);
  return {
    ...result,
    ...(resumed ? { effective_window_end: resumed } : {}),
    ...(reportRevisions.length ? { report_revisions: reportRevisions } : {}),
    budget_thb,
    plan_hash: planHash(scenario, incident, budget_thb, result.joint.lines),
    state_version: snapshot.state_version,
  };
}

export async function reservePlan(request: ReservationRequest) {
  const { scenario, incident, budget_thb, lines, plan_hash } = request;
  if (planHash(scenario, incident, budget_thb, lines) !== plan_hash) {
    throw new ApiError("PLAN_HASH_MISMATCH");
  }
  const cost = lines.reduce((sum, line) => sum + line.qty * line.unit_cost_thb, 0);
  if (cost > budget_thb) throw new ApiError("OVER_BUDGET");
  return getStore().reserve(request);
}
