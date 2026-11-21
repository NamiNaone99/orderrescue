import { publicState } from "@/lib/api/state";
import { stateRequestSchema } from "@/lib/domain/contracts";
import { apiRoute, readQuery } from "@/lib/http";
import { getStore } from "@/lib/store";

export function GET(request: Request) {
  return apiRoute(request, async () => {
    const { scenario, sku } = readQuery(request, stateRequestSchema);
    const snapshot = await getStore().getSnapshot(scenario, sku ? { sku } : { openSkusOnly: true });
    return { body: publicState(snapshot) };
  });
}
