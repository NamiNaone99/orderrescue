import { createHash } from "node:crypto";
import { bangkokTimestamp } from "@/lib/domain/time";
import { realDaySamples } from "@/lib/scenarios/realDayFormat";
import { demoDate, sliceDate, type RetailSlice } from "./retail-slice";

const seed = 20261121;
export const config = {
  now: "12:30", cutoff: "11:00", stock_factor: 1.1, shares: [0.5, 0.3, 0.2], share_jitter: 0.1,
  max_alternate_committed_fraction: 0.4, base_ready: ["13:00", "13:30", "15:00"], alternate_jitter_minutes: 30,
  cost_per_unit_thb: [0, 4, 7], lead_hours: [2, 4, 6], earliest_lead_minutes: 60, closing: "18:00",
  default_budget_thb: 200, default_sku_id: "23084",
};

const fields = {
  "scenario.id": "synthetic", "scenario.name_th": "synthetic", "scenario.name_en": "synthetic", "scenario.kind": "synthetic",
  "scenario.now_at": "simulated", "scenario.shifts": "simulated", "scenario.default_budget_thb": "simulated",
  "scenario.default_sku_id": "real", "scenario.demo_events": "synthetic", "scenario.sample_messages": "synthetic",
  "warehouses.id": "simulated", "warehouses.name_th": "simulated", "warehouses.is_home": "simulated",
  "skus.id": "real", "skus.name": "real", "orders.id": "real", "orders.received_at": "real_shifted",
  "orders.customer_ref": "opaque", "orders.country": "real", "orders.deadline_at": "simulated",
  "orders.home_warehouse_id": "simulated", "orders.status": "simulated", "orders.lines.sku_id": "real",
  "orders.lines.qty": "real", "orders.lines.unit_price_gbp": "real", "stock.warehouse_id": "simulated",
  "stock.sku_id": "simulated", "stock.on_hand": "simulated", "stock.committed": "simulated",
  "stock.ready_at": "simulated", "stock.extra_cost_per_unit_thb": "simulated", "stock.revision": "simulated",
};

function draw(table: string, key: string, field: string) {
  return createHash("sha256").update([seed, table, key, field].join("|")).digest().readUInt32BE(0) / 2 ** 32;
}
function minutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
function timestamp(minute: number) {
  const time = [Math.floor(minute / 60), minute % 60].map(n => String(n).padStart(2, "0")).join(":");
  return bangkokTimestamp(demoDate, time);
}

const warehouses = [
  { id: "A", name_th: "คลัง A บางนา", is_home: true },
  { id: "B", name_th: "คลัง B ลาดกระบัง", is_home: false },
  { id: "C", name_th: "คลัง C รังสิต", is_home: false },
] as const;

function splitStock(total: number, sku: string, settings: typeof config) {
  // Pairwise differences bound each share's jitter while the three shares still sum to one.
  const offsets = warehouses.map(w => settings.share_jitter * draw("stock", w.id + "/" + sku, "share"));
  const exact = settings.shares.map((share, i) => total * (share + offsets[i] - offsets[(i + 1) % offsets.length]));
  const units = exact.map(Math.floor);
  const remainder = total - units.reduce((a, b) => a + b);
  const fractions = exact.map((n, i) => ({ i, fraction: n - units[i] })).sort((a, b) => b.fraction - a.fraction || a.i - b.i);
  for (const { i } of fractions.slice(0, remainder)) units[i]++;
  return units;
}

export function deriveDay(slice: RetailSlice, settings = config) {
  const scenario = {
    id: "real-day", name_th: "คำสั่งซื้อจริงหนึ่งวัน", name_en: "Real-order day", kind: "real_derived",
    now_at: bangkokTimestamp(demoDate, settings.now), default_budget_thb: settings.default_budget_thb,
    default_sku_id: settings.default_sku_id,
    shifts: [{ name_th: "รอบเช้า", start: "08:00", end: "12:00" }, { name_th: "รอบบ่าย", start: "13:00", end: "18:00" }],
    demo_events: [], sample_messages: realDaySamples.map(({ text, label_th }) => ({ text, label_th })),
  };
  const demand = new Map<string, number>();
  const prior = new Map<string, number>();
  const orders = slice.orders.map(({ id, time, country, customer_ref, lines }) => {
    const lead = settings.lead_hours[Math.floor(draw("orders", id, "lead_hours") * settings.lead_hours.length)];
    const rounded = Math.ceil((minutes(time) + lead * 60) / 30) * 30;
    const deadline = Math.min(minutes(settings.closing), Math.max(rounded, minutes(settings.now) + settings.earliest_lead_minutes));
    const reserved = time < settings.cutoff;
    for (const line of lines) {
      demand.set(line.sku_id, (demand.get(line.sku_id) ?? 0) + line.qty);
      if (reserved) prior.set(line.sku_id, (prior.get(line.sku_id) ?? 0) + line.qty);
    }
    return { id, received_at: bangkokTimestamp(demoDate, time), customer_ref, country,
      deadline_at: timestamp(deadline), home_warehouse_id: "A", status: reserved ? "reserved" : "open", lines };
  });
  const factorPercent = Math.round(settings.stock_factor * 100);
  const splits = slice.skus.map(({ id }) => splitStock(Math.ceil((demand.get(id) ?? 0) * factorPercent / 100), id, settings));
  const stock = warehouses.flatMap((w, i) => slice.skus.map(({ id }, skuIndex) => {
    const key = w.id + "/" + id;
    const onHand = splits[skuIndex][i];
    const committed = w.is_home ? Math.min(prior.get(id) ?? 0, onHand)
      : Math.floor(onHand * settings.max_alternate_committed_fraction * draw("stock", key, "committed"));
    const delay = !w.is_home && draw("stock", key, "ready_at") >= 0.5 ? settings.alternate_jitter_minutes : 0;
    return { warehouse_id: w.id, sku_id: id, on_hand: onHand, committed,
      ready_at: timestamp(minutes(settings.base_ready[i]) + delay), extra_cost_per_unit_thb: settings.cost_per_unit_thb[i], revision: 1 };
  }));
  return {
    provenance: {
      source_name: "Online Retail II", source_url: "https://archive.ics.uci.edu/dataset/502/online+retail+ii",
      mirror: "kaggle:mashlyn/online-retail-ii-uci", licence: "CC BY 4.0", licence_url: "https://creativecommons.org/licenses/by/4.0/",
      citation: "Chen, D. (2012). Online Retail II [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C5CG6D.",
      doi: "10.24432/C5CG6D", source_file_sha256: slice.sourceHash, slice_date: sliceDate, demo_date: demoDate,
      seed, config: settings, row_counts: slice.counts, fields,
    },
    scenario, warehouses, skus: slice.skus, stock, orders,
  };
}
