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
  const result = plan(snapshot, incident, budget_thb);
  return {
    ...result,
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
