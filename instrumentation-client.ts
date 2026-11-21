import { config } from "zod/v4/core";

if (process.env.NODE_ENV === "production") {
  // Use Zod's CSP-compatible parser without probing dynamic JavaScript evaluation.
  config({ jitless: true });
}
