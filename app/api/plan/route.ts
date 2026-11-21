import { createPlan } from "@/lib/api/planning";
import { planRequestSchema } from "@/lib/domain/contracts";
import { ApiError, apiRoute, readBody } from "@/lib/http";
import { takePlanningRequest } from "@/lib/ratelimit";

export function POST(request: Request) {
  return apiRoute(request, async () => {
    if (!takePlanningRequest(request)) throw new ApiError("RATE_LIMITED");
    const input = await readBody(request, planRequestSchema);
    return { body: await createPlan(input) };
  });
}
