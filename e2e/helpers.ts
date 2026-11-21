import type { APIRequestContext } from "@playwright/test";
import type { ScenarioId } from "@/lib/domain/types";

export async function resetDemo(request: APIRequestContext, scenario: ScenarioId = "hero") {
  const response = await request.post("/api/demo/reset", {
    data: { scenario },
    headers: { "x-demo-token": process.env.DEMO_RESET_TOKEN ?? "local-token" },
  });
  if (!response.ok() && response.status() !== 404) {
    throw new Error(`Failed to reset ${scenario} (HTTP ${response.status()})`);
  }
}
