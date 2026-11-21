import { test as base } from "@playwright/test";
import { smokeOrigin } from "./smoke-env";

// Reuse only host-scoped cookies. A page may load resources from a different origin.
export const test = base.extend<{ deployedScope: void }>({
  deployedScope: [async ({}, provide, info) => {
    if (smokeOrigin().startsWith("https:") && !info.tags.includes("@smoke")) throw new Error("Hosted runs require a tagged smoke check");
    await provide();
  }, { auto: true }],
  storageState: async ({}, provide) => {
    const saved = process.env.ORDERRESCUE_SMOKE_COOKIES;
    await provide(saved ? { cookies: JSON.parse(saved), origins: [] } : undefined);
  },
});
