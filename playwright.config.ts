import { defineConfig, devices } from "@playwright/test";

const localURL = "http://localhost:3000";
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["html", { open: "never" }]],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  use: {
    baseURL: process.env.BASE_URL ?? localURL,
    extraHTTPHeaders: bypassSecret ? {
      "x-vercel-protection-bypass": bypassSecret,
      "x-vercel-set-bypass-cookie": "true",
    } : undefined,
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
