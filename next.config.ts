import type { NextConfig } from "next";
import { existsSync } from "node:fs";

const nextConfig: NextConfig = {
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    if (process.env.NODE_ENV === "production") {
      headers.push({ key: "Content-Security-Policy",
        value: "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'",
      });
    }
    return [{ source: "/:path*", headers }];
  },
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
