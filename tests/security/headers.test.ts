import { afterEach, expect, it, vi } from "vitest";
import config from "../../next.config";
import robots from "../../app/robots";

const standard = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};
afterEach(() => vi.unstubAllEnvs());

it.each(["development", "production"])("sets the public demo headers in %s", async mode => {
  vi.stubEnv("NODE_ENV", mode);
  const rules = await config.headers?.();
  expect(rules).toHaveLength(1);
  expect(rules?.[0].source).toBe("/:path*");
  const headers = Object.fromEntries(rules?.[0].headers.map(({ key, value }) => [key, value]) ?? []);
  expect(headers).toEqual(mode === "development" ? standard : { ...standard,
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'",
  });
});

it("disallows indexing the entire demo", () => {
  expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
});
