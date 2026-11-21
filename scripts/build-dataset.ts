import { mkdir, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { bangkokTimestamp } from "@/lib/domain/time";
import { plan } from "@/lib/planner";
import { realDaySnapshot } from "@/lib/scenarios/realDayFormat";
import { config, deriveDay } from "./derive-retail-day";
import { demoDate, readSlice } from "./retail-slice";

const rawFile = "data/raw/online_retail_II.csv";
const outputFile = "data/derived/day-2011-11-22.json";

export async function buildDataset(input: string, output: string) {
  const slice = await readSlice(input);
  const day = deriveDay(slice);
  await mkdir(dirname(output), { recursive: true });
  const temporary = output + "." + randomUUID() + ".tmp";
  await writeFile(temporary, JSON.stringify(day, null, 2) + "\n", "utf8");
  await rename(temporary, output);
  return day;
}

export function reportPlan(day: ReturnType<typeof deriveDay>) {
  const result = plan(realDaySnapshot(day), {
    warehouse_id: "A", sku_id: day.scenario.default_sku_id,
    window_start: bangkokTimestamp(demoDate, "13:00"), window_end: bangkokTimestamp(demoDate, "18:00"),
  }, day.scenario.default_budget_thb);
  return {
    affected: result.affected.length,
    first_come: { on_time: result.first_come.on_time, cost_thb: result.first_come.extra_cost_thb },
    joint: { on_time: result.joint.on_time, cost_thb: result.joint.extra_cost_thb, needs_human: result.joint.needs_human.length },
    solver: result.solver,
  };
}

async function main() {
  const day = await buildDataset(rawFile, outputFile);
  const counts = day.provenance.row_counts;
  console.log(JSON.stringify(counts));
  for (const [field, expected] of Object.entries({ orders: 129, lines: 2802, skus: 1190 })) {
    const actual = counts[field as keyof typeof counts];
    console.log(field, "actual", actual, "research estimate", expected, actual === expected ? "(match)" : "(difference after merging)");
  }
  const times = day.orders.map(order => order.received_at.slice(11, 16)).sort();
  console.log("Order times", times[0], "to", times.at(-1), "(research estimate 08:19 to 17:32)");
  const lines = day.orders.flatMap(order => order.lines);
  const contested = [["23084", 25, 576], ["22086", 18, 359], ["23355", 15, 124], ["22138", 15, 80]] as const;
  for (const [sku, expectedLines, expectedUnits] of contested) {
    const matching = lines.filter(line => line.sku_id === sku);
    const units = matching.reduce((total, line) => total + line.qty, 0);
    console.log("SKU", sku, "merged lines", matching.length, "units", units, "research estimate", expectedLines, expectedUnits);
  }
  if (process.argv.includes("--tune")) {
    console.log("Frozen settings", JSON.stringify(config));
    console.log("Whole affected set", JSON.stringify(reportPlan(day)));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve("scripts/build-dataset.ts")) {
  main().catch(error => { console.error(error instanceof Error ? error.message : "Dataset build failed"); process.exitCode = 1; });
}
