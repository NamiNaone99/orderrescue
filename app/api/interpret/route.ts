import "server-only";
import { interpretRequestSchema } from "@/lib/domain/contracts";
import { apiRoute, readBody } from "@/lib/http";
import { interpret } from "@/lib/interpreter";
import { getInterpreterRuntime } from "@/lib/interpreter/runtime";
import { clientIp, getInterpreterQuota } from "@/lib/ratelimit";
import { getStore } from "@/lib/store";

export const maxDuration = 30;

export function POST(request: Request) {
  return apiRoute(request, async log => {
    const { scenario, message } = await readBody(request, interpretRequestSchema);
    log.messageLength = message.length;
    const snapshot = await getStore().getSnapshot(scenario);
    const { clients } = getInterpreterRuntime();
    const allowAttempt = clients.length ? getInterpreterQuota().forRequest(clientIp(request)) : undefined;
    return { body: await interpret(message, snapshot, { clients, allowAttempt }) };
  });
}
