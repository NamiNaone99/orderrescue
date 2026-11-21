import { Database, Fingerprint, MessageSquareText, SlidersHorizontal } from "lucide-react";
import { dataCopy as c, type CopyEntry } from "@/lib/copy";
import { fill, parameters, type FieldKind, type Provenance } from "@/lib/provenance";

const icons = { real: Database, simulated: SlidersHorizontal, synthetic: MessageSquareText, real_shifted: Database, opaque: Fingerprint };

export function Text({ item }: { item: CopyEntry }) {
  return <>{item.th}<span className="provenance-en" lang="en">{item.en}</span></>;
}
export function Label({ kind }: { kind: FieldKind }) {
  const Icon = icons[kind];
  return <span className="provenance-chip" data-kind={kind}><Icon size={15} aria-hidden="true" />
    {c.labels[kind].th} <span lang="en">{c.labels[kind].en}</span></span>;
}

const rules: Record<string, keyof typeof c.rules> = {
  "scenario.now_at": "clock", "scenario.shifts": "shift", "scenario.default_budget_thb": "budget", "scenario.default_sku_id": "defaultSku",
  "warehouses.id": "warehouse", "warehouses.name_th": "warehouse", "warehouses.is_home": "warehouse",
  "skus.name": "name", "orders.received_at": "orderTime", "orders.customer_ref": "ref", "orders.deadline_at": "deadline",
  "orders.home_warehouse_id": "warehouse", "orders.status": "status", "orders.lines.qty": "quantity",
  "stock.warehouse_id": "stockSku", "stock.sku_id": "stockSku", "stock.on_hand": "stock", "stock.committed": "committed",
  "stock.ready_at": "ready", "stock.extra_cost_per_unit_thb": "cost", "stock.revision": "revision",
};

export function ProvenanceTable({ p }: { p: Provenance }) {
  const values = parameters(p);
  const fields = Object.entries(p.fields ?? {});
  if (!fields.length) return null;
  return <section className="provenance-panel"><h2><Text item={c.fields} /></h2>
    <table className="provenance-fields"><thead><tr>{[c.field,c.classification,c.rule].map(item => <th key={item.en} scope="col"><Text item={item} /></th>)}</tr></thead>
      <tbody>{fields.map(([field, kind]) => {
        const fallback = kind === "synthetic" ? c.rules.team : kind === "simulated" ? c.rules.model : c.rules.source;
        const rule = fill(c.rules[rules[field]] ?? fallback, values);
        return <tr key={field}><th scope="row"><code>{field}</code></th><td><Label kind={kind} /></td><td>{rule && <Text item={rule} />}</td></tr>;
      })}</tbody>
    </table>
  </section>;
}
