import "server-only";
import { expect, it } from "vitest";

it("reads the Bangkok start time as the same instant in any time zone", () => {
  const start = new Date("2026-11-21T10:00:00+07:00");
  expect(start.toISOString()).toBe("2026-11-21T03:00:00.000Z");
});
