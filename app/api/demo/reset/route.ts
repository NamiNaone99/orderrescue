import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { demoResetRequestSchema } from "@/lib/domain/contracts";
import { ApiError, apiRoute, readBody } from "@/lib/http";
import { clientIp, takeHeroReset } from "@/lib/ratelimit";
import { getStore } from "@/lib/store";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function POST(request: Request) {
  return apiRoute(request, async () => {
    const { scenario } = await readBody(request, demoResetRequestSchema);
    if (scenario === "hero") {
      if (!takeHeroReset(clientIp(request))) throw new ApiError("RATE_LIMITED");
    } else {
      const expected = process.env.DEMO_RESET_TOKEN;
      const token = request.headers.get("x-demo-token");
      if (!expected || !token || !timingSafeEqual(digest(expected), digest(token))) {
        throw new ApiError("UNAUTHORIZED");
      }
    }
    await getStore().reset(scenario);
    return { body: { ok: true } };
  });
}
