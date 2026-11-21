import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { realDaySnapshot } from "@/lib/scenarios/realDayFormat";

const source = "data/derived/day-2011-11-22.json";
const target = "supabase/seed.sql";
const start = "-- BEGIN GENERATED REAL-DAY";
const end = "-- END GENERATED REAL-DAY";
const sql = readFileSync(target, "utf8").replaceAll("\r\n", "\n");
const before = sql.indexOf("\n" + start + "\n") + 1;
const after = sql.lastIndexOf("\n" + end + "\n") + 1;
if (!before || after <= before) throw new Error("Missing real-day markers in seed.sql");

let section = "";
if (existsSync(source)) {
  const day = realDaySnapshot(JSON.parse(readFileSync(source, "utf8")));
  if (day.scenario.id !== "real-day" || day.scenario.kind !== "real_derived") throw new Error("Unexpected derived scenario");
  const json = JSON.stringify({ ...day, event_changes: {} });
  section = `select pg_temp.install_scenario('real-day', '${json.replaceAll("'", "''")}'::jsonb);\n`;
  console.log(`Prepared ${day.orders.length} orders and ${day.order_lines.length} real-day lines.`);
} else {
  console.log("No derived real-day file. The SQL seed contains hero and hero-test.");
}
const updated = sql.slice(0, before) + start + "\n" + section + sql.slice(after);
if (updated !== sql) writeFileSync(target, updated, "utf8");
