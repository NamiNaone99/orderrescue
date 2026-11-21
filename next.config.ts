import type { NextConfig } from "next";
import { existsSync } from "node:fs";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The API writes its own request-ID log without raw query strings.
  logging: { incomingRequests: { ignore: [/^\/api\//] } },
  turbopack: {
    // Keep T13's static JSON import when installed. A hero-only checkout has no real-day module to bundle.
    resolveAlias: existsSync("data/derived/day-2011-11-22.json") ? {} : {
      "@/lib/scenarios": "./lib/scenarios/heroRegistry.ts",
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
