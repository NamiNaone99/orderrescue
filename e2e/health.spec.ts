import { expect, test } from "@playwright/test";
import { healthResponseSchema } from "../lib/domain/contracts";
import { resetDemo } from "./helpers";

test("health identifies the running commit", { tag: "@smoke" }, async ({ request }) => {
  await resetDemo(request);
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const health = healthResponseSchema.parse(await response.json());
  expect(health.ok).toBe(true);
  expect(health.commit).toMatch(/\S/);
});
