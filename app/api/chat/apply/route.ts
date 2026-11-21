import { chatApplySchema } from "@/lib/domain/contracts";
import { apiRoute, ApiError, readBody } from "@/lib/http";
import { verifiedReport } from "@/lib/interpreter/chat";
import { takePlanningRequest } from "@/lib/ratelimit";
import { getStore } from "@/lib/store";

export function POST(request: Request) {
  return apiRoute(request, async () => {
    if (!takePlanningRequest(request)) throw new ApiError("RATE_LIMITED");
    const input = await readBody(request, chatApplySchema);
    const store = getStore();
    const snapshot = await store.getSnapshot(input.scenario);
    const event = verifiedReport(input, snapshot);
    if (!event) throw new ApiError("INVALID_INPUT");
    return { body: await store.applyWarehouseReport(input.scenario, input.key, event) };
  });
}
