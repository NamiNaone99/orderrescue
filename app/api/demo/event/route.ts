import { demoEventRequestSchema } from "@/lib/domain/contracts";
import { apiRoute, readBody } from "@/lib/http";
import { getStore } from "@/lib/store";

export function POST(request: Request) {
  return apiRoute(request, async () => {
    const { scenario, event_id } = await readBody(request, demoEventRequestSchema);
    return { body: await getStore().applyDemoEvent(scenario, event_id) };
  });
}
