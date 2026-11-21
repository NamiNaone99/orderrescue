import { reservePlan } from "@/lib/api/planning";
import { reservationRequestSchema } from "@/lib/domain/contracts";
import { ApiError, apiRoute, readBody } from "@/lib/http";
import { takePlanningRequest } from "@/lib/ratelimit";

export function POST(request: Request) {
  return apiRoute(request, async log => {
    if (!takePlanningRequest(request)) throw new ApiError("RATE_LIMITED");
    const input = await readBody(request, reservationRequestSchema);
    const result = await reservePlan(input);
    log.receiptId = result.receipt.id;
    return { body: result, status: result.replayed ? 200 : 201 };
  });
}
