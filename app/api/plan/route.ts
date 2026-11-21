import { createPlan } from "@/lib/api/planning";
import { planRequestSchema } from "@/lib/domain/contracts";
import { apiRoute, readBody } from "@/lib/http";

export function POST(request: Request) {
  return apiRoute(request, async () => {
    const input = await readBody(request, planRequestSchema);
    return { body: await createPlan(input) };
  });
}
