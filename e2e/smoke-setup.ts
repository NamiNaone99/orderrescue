import { request } from "@playwright/test";
import { healthyCommit, smokeOrigin } from "./smoke-env";

export default async function prepareSmoke() {
  const baseURL = smokeOrigin();
  const remote = baseURL.startsWith("https:");
  const client = await request.newContext({ baseURL });
  try {
    const bypass = remote && process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    const resetToken = remote && process.env.DEMO_RESET_TOKEN;
    // Playwright workers need only the host-scoped browser cookie, never either original secret.
    delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    delete process.env.DEMO_RESET_TOKEN;
    if (bypass) {
      // Exchange once on the verified origin. Never forward this header across a redirect.
      const exchange = await client.get("/", { maxRedirects: 0, headers: {
        "x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "true",
      } }).catch(() => { throw new Error("Vercel browser authentication failed"); });
      if (exchange.status() >= 400) throw new Error("Vercel browser authentication refused (HTTP " + exchange.status() + ")");
    }
    const hostname = new URL(baseURL).hostname;
    const cookies = (await client.storageState()).cookies.map(cookie => ({ ...cookie, domain: hostname }));
    process.env.ORDERRESCUE_SMOKE_COOKIES = JSON.stringify(cookies);
    const commit = await healthyCommit(client);
    if (remote) process.env.ORDERRESCUE_EXPECTED_SHA = commit;
    async function resetHero() {
      const deadline = Date.now() + 70_000;
      for (;;) {
        await healthyCommit(client);
        const response = await client.post("/api/demo/reset", { data: { scenario: "hero" }, maxRedirects: 0,
          headers: resetToken ? { "x-demo-token": resetToken } : {},
        }).catch(() => { throw new Error("Synthetic hero reset request failed"); });
        if (response.status() === 200) return;
        if (response.status() !== 429 || Date.now() >= deadline) throw new Error("Synthetic hero reset failed (HTTP " + response.status() + ")");
        await new Promise(resolve => setTimeout(resolve, 5_000));
      }
    }
    await resetHero();
    return async () => {
      try { await resetHero(); } finally { await client.dispose(); }
    };
  } catch (error) {
    await client.dispose();
    throw error;
  }
}
