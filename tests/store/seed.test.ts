import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { heroEventChanges, heroSnapshot } from "@/lib/scenarios/hero";
import { realDaySnapshot } from "@/lib/scenarios/realDayFormat";

it("seeds hero and its isolated test copy from the exact TypeScript fixture", () => {
  const sql = readFileSync("supabase/seed.sql", "utf8");
  const seed = sql.match(/\$hero\$([\s\S]+?)\$hero\$::jsonb/);
  expect(seed).toBeTruthy();
  expect(JSON.parse(seed?.[1] ?? "null")).toEqual({ ...heroSnapshot, event_changes: heroEventChanges });
  expect(sql).toContain("from (values ('hero'),('hero-test')) scenarios(id)");
});

const derived = "data/derived/day-2011-11-22.json";
it.skipIf(!existsSync(derived))("seeds every operational real-day row from the derived day", () => {
  const sql = readFileSync("supabase/seed.sql", "utf8");
  const seed = sql.match(/install_scenario\('real-day', '([^\n]*)'::jsonb\);/);
  expect(seed).toBeTruthy();
  expect(JSON.parse(seed?.[1].replaceAll("''", "'") ?? "null")).toEqual({
    ...realDaySnapshot(JSON.parse(readFileSync(derived, "utf8"))), event_changes: {},
  });
});
