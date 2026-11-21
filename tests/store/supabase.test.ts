import { afterAll, describe } from "vitest";
import { SupabaseStore } from "@/lib/store/supabase";
import { storeContract } from "./contract";

const enabled = process.env.npm_lifecycle_event === "test:db"
  && Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);

describe.skipIf(!enabled)("Supabase database", () => {
  const scenarioId = "hero-test";
  const store = new SupabaseStore<typeof scenarioId>();
  storeContract(() => ({ store, scenarioId }));
  afterAll(() => store.reset(scenarioId), 30_000);
});
