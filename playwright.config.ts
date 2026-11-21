import { defineConfig, devices } from "@playwright/test";

import { smokeOrigin } from "./e2e/smoke-env";

const localURL = "http://localhost:3000";
const baseURL = smokeOrigin();
const smoke = process.env.ORDERRESCUE_SMOKE === "1";
if (baseURL.startsWith("https:") && !smoke) throw new Error("Use pnpm smoke for hosted OrderRescue checks");

export default defineConfig({
  testDir: "./e2e",
  testMatch: smoke ? ["**/health.spec.ts", "**/home.spec.ts", "**/hero.spec.ts", "**/stale.spec.ts"] : undefined,
  grep: smoke ? /@smoke/ : undefined,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI && !smoke ? 1 : 0,
  globalSetup: smoke ? "./e2e/smoke-setup.ts" : undefined,
  timeout: smoke ? 75_000 : 30_000,
  reporter: [["html", { open: "never" }]],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  use: {
    baseURL,
  },
  webServer: process.env.BASE_URL === undefined ? {
    command: "pnpm build && pnpm start",
    url: localURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      STORAGE_MODE: "memory",
      INTERPRETER_MODE: "offline",
      DEMO_RESET_TOKEN: process.env.DEMO_RESET_TOKEN ?? "local-token",
    },
  } : undefined,
});
