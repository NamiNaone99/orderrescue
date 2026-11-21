import { expect } from "@playwright/test";
import { healthyCommit } from "./smoke-env";
import { test } from "./smoke-test";

test("health identifies the running commit", { tag: "@smoke" }, async ({ request }) => {
  expect(await healthyCommit(request)).toMatch(/\S/);
});
