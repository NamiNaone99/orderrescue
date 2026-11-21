import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { expect, it } from "vitest";

const names = ["OPENAI_API_KEY", "SUPABASE_SECRET_KEY", "DEMO_RESET_TOKEN"] as const;
const openAiToken = /(^|[^A-Za-z0-9_-])sk-(proj-|svcacct-)?[A-Za-z0-9_-]{20,}/;
const supabaseToken = /sb_secret_[A-Za-z0-9_-]{8,}/;

function containsCredential(content: string, configured: string[]) {
  return openAiToken.test(content) || supabaseToken.test(content)
    || names.some(name => content.includes(name)) || configured.some(value => content.includes(value));
}

it("recognizes inert token formats, private variable names and configured values without flagging CSS mask names", () => {
  const body = "a".repeat(20);
  for (const prefix of ["sk-", "sk-proj-", "sk-svcacct-"]) {
    expect(containsCredential('"' + prefix + body + '"', [])).toBe(true);
  }
  expect(containsCredential("sb_secret_" + "b".repeat(8), [])).toBe(true);
  for (const name of names) expect(containsCredential(name, [])).toBe(true);
  expect(containsCredential("const value = 'inert test marker';", ["inert test marker"])).toBe(true);
  expect(containsCredential(".mask-" + body + "{mask-mode:alpha}", [])).toBe(false);
});

const output = resolve(".next");
const built = existsSync(output);
if (!built) process.stdout.write("Bundle scan skipped: .next is absent. Run pnpm build to scan browser assets.\n");

it.skipIf(!built)("keeps server credentials out of every built browser asset", async () => {
  const root = join(output, "static");
  const configured = names.map(name => process.env[name]).filter((value): value is string => !!value);
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const files = entries.filter(entry => entry.isFile());
  expect(files.length, "Expected browser assets in .next/static").toBeGreaterThan(0);
  const findings: string[] = [];
  for (const file of files) {
    const path = join(file.parentPath, file.name);
    if (containsCredential(await readFile(path, "utf8"), configured)) {
      const name = relative(root, path);
      findings.push(containsCredential(name, configured) ? "(redacted asset path)" : name);
    }
  }
  expect(findings, "Browser assets containing server credential markers").toEqual([]);
});
