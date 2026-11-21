import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { afterAll, beforeAll, expect, it } from "vitest";
import data from "@/data/derived/day-2011-11-22.json";
import { plan } from "@/lib/planner";
import { offlineInterpret } from "@/lib/interpreter/offline";
import { scenarioRegistry } from "@/lib/scenarios";
import { buildDataset } from "@/scripts/build-dataset";
import { deriveDay } from "@/scripts/derive-retail-day";
import { readSlice } from "@/scripts/retail-slice";

const fixture = "tests/fixtures/orii-sample.csv";
let temp: string;
beforeAll(async () => { temp = await mkdtemp(join(tmpdir(), "orderrescue-retail-")); });
afterAll(async () => { await rm(temp, { recursive: true, force: true }); });

it("filters the 200-row excerpt, merges the repeated product and assigns opaque customer references", async () => {
  const slice = await readSlice(fixture);
  expect(slice.counts).toEqual({ raw_rows_on_date: 200, filtered_rows: 189, orders: 18, lines: 188, skus: 172 });
  expect(slice.orders.find(o => o.id === "577855")?.lines.find(l => l.sku_id === "22435")?.qty).toBe(2);
  const rows = parse(await readFile(fixture), { columns: true }) as Record<string, string>[];
  const ids = [...new Set(rows.map(row => row["Customer ID"]).filter(Boolean))].map(Number).sort((a, b) => a - b);
  expect(ids).toEqual(Array.from({ length: ids.length }, (_, i) => i + 1));
  const invalid = rows.filter(r => r.Invoice.startsWith("C") || Number(r.Quantity) <= 0 || Number(r.Price) <= 0
    || !r["Customer ID"] || !/^\d{5}[A-Za-z]{0,2}$/.test(r.StockCode));
  expect(invalid).toHaveLength(11);
  for (const row of invalid) {
    expect(slice.orders.find(o => o.id === row.Invoice)?.lines.some(l => l.sku_id === row.StockCode)).toBeFalsy();
  }
  expect(slice.orders.every(o => /^C\d{3}$/.test(o.customer_ref))).toBe(true);
});

it("builds byte-identical files from unchanged input and exports no private source customer value", async () => {
  const a = join(temp, "a.json");
  const b = join(temp, "b.json");
  const first = await buildDataset(fixture, a);
  await buildDataset(fixture, b);
  expect((await readFile(a)).equals(await readFile(b))).toBe(true);
  expect(first.orders.every(o => o.lines.length > 0)).toBe(true);
  expect(first.stock.every(s => 0 <= s.committed && s.committed <= s.on_hand)).toBe(true);
  // A unique marker distinguishes a leaked customer value from valid numeric SKU IDs.
  const source = await readFile(fixture, "utf8");
  const masked = source.replace(/,1,(?=[^,\r\n]+\r?$)/gm, ",private-customer-marker,");
  expect(masked).not.toBe(source);
  const marked = join(temp, "marked.csv");
  await writeFile(marked, masked);
  const output = await buildDataset(marked, join(temp, "marked.json"));
  expect(JSON.stringify(output)).not.toContain("private-customer-marker");
  expect(output.orders).toEqual(first.orders);
});

it("preserves all derived values when the source rows are permuted", async () => {
  const original = deriveDay(await readSlice(fixture));
  const [header, ...rows] = (await readFile(fixture, "utf8")).trimEnd().split(/\r?\n/);
  const reversed = join(temp, "reverse.csv");
  await writeFile(reversed, [header, ...rows.reverse()].join("\n") + "\n");
  const rebuilt = deriveDay(await readSlice(reversed));
  expect(rebuilt.provenance.source_file_sha256).not.toBe(original.provenance.source_file_sha256);
  expect({ ...rebuilt, provenance: { ...rebuilt.provenance, source_file_sha256: "" } })
    .toEqual({ ...original, provenance: { ...original.provenance, source_file_sha256: "" } });
});

it("pins the verified full-day counts, simulated inventory and reproducible planner comparison", () => {
  const day = scenarioRegistry["real-day"].snapshot;
  expect(data.provenance.row_counts).toEqual({ raw_rows_on_date: 3967, filtered_rows: 2802, orders: 129, lines: 2674, skus: 1190 });
  expect(day.orders).toHaveLength(129);
  expect(day.order_lines).toHaveLength(2674);
  expect(day.skus).toHaveLength(1190);
  expect(day.stock).toHaveLength(3570);
  expect(data.orders.every(o => o.lines.length && /^C\d{3}$/.test(o.customer_ref))).toBe(true);
  const demand = new Map<string, number>();
  for (const line of day.order_lines) demand.set(line.sku_id, (demand.get(line.sku_id) ?? 0) + line.qty);
  const onHand = new Map<string, number>();
  for (const row of day.stock) {
    expect(row.committed >= 0 && row.committed <= row.on_hand).toBe(true);
    onHand.set(row.sku_id, (onHand.get(row.sku_id) ?? 0) + row.on_hand);
  }
  for (const [sku, qty] of demand) expect(onHand.get(sku)).toBe(Math.ceil(qty * 110 / 100));
  expect(day.scenario).toMatchObject({ kind: "real_derived", default_sku_id: "23084", default_budget_thb: 200 });
  const result = plan(day, { warehouse_id: "A", sku_id: "23084",
    window_start: "2026-11-21T13:00:00+07:00", window_end: "2026-11-21T18:00:00+07:00" }, day.scenario.default_budget_thb);
  expect(result.affected).toHaveLength(21);
  expect(result.first_come).toMatchObject({ on_time: 15, extra_cost_thb: 184 });
  expect(result.joint).toMatchObject({ on_time: 16, extra_cost_thb: 184 });
  expect(result.joint.needs_human).toHaveLength(5);
});

it.each(scenarioRegistry["real-day"].sampleMessages)("serves and interprets real-day sample $label_th", sample => {
  const { snapshot } = scenarioRegistry["real-day"];
  expect(snapshot.scenario.sample_messages).toContainEqual({ text: sample.text, label_th: sample.label_th });
  expect(sample.text).toContain(sample.expected.evidence_quote);
  expect(offlineInterpret(sample.text, snapshot)).toEqual(sample.expected);
});
