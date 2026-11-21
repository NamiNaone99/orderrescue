import type { Snapshot, Warehouse } from "@/lib/domain/types";
import { heroEventChanges, heroSnapshot } from "@/lib/scenarios/hero";

export function heroStockRow(snapshot: Snapshot, warehouseId: Warehouse["id"]) {
  const row = snapshot.stock.find(
    stock => stock.warehouse_id === warehouseId && stock.sku_id === "SKU-X",
  );
  if (!row) throw new Error(`Missing hero stock row for warehouse ${warehouseId}`);
  return row;
}

export function heroAfterSlip() {
  const snapshot = structuredClone(heroSnapshot);
  const change = heroEventChanges["b-slips-1430"];
  const row = heroStockRow(snapshot, change.warehouse_id);
  row.ready_at = change.ready_at;
  row.revision += change.revision_increment;
  return snapshot;
}
