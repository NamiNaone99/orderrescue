import { reservePlan } from "@/lib/api/planning";
import { reservationRequestSchema } from "@/lib/domain/contracts";
import { apiRoute, readBody } from "@/lib/http";

export function POST(request: Request) {
  return apiRoute(request, async log => {
    const input = await readBody(request, reservationRequestSchema);
    const result = await reservePlan(input);
    log.receiptId = result.receipt.id;
    return { body: result, status: result.replayed ? 200 : 201 };
  });
}
