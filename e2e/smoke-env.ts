import type { APIRequestContext } from "@playwright/test";
import { healthResponseSchema } from "../lib/domain/contracts";
import { targetOrigin } from "../scripts/smoke-target.mjs";

export function smokeOrigin() {
  const input = process.env.BASE_URL ?? "http://localhost:3000";
  return targetOrigin(input, {
    local: true,
    deployment: process.env.GITHUB_ACTIONS === "true" && process.env.ORDERRESCUE_DISPATCH_URL === input &&
      /^[a-f0-9]{40}$/.test(process.env.ORDERRESCUE_EXPECTED_SHA ?? ""),
  });
}

export async function healthyCommit(client: APIRequestContext) {
  const response = await client.get("/api/health", { maxRedirects: 0 })
    .catch(() => { throw new Error("Could not read deployment health"); });
  if (response.status() !== 200) throw new Error("Smoke health check failed (HTTP " + response.status() + ")");
  const parsed = healthResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new Error("Invalid deployment health response");
  const health = parsed.data;
  const remote = smokeOrigin().startsWith("https:");
  if (!health.ok || health.degraded || (remote && !/^[a-f0-9]{40}$/.test(health.commit)) ||
      (process.env.ORDERRESCUE_EXPECTED_SHA && health.commit !== process.env.ORDERRESCUE_EXPECTED_SHA)) {
    throw new Error("Smoke requires a healthy deployment at the expected revision");
  }
  return health.commit;
}
