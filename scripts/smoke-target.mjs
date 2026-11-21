import { readFileSync, appendFileSync } from "node:fs";

export const production = "https://orderrescue.vercel.app";
const immutable = /^orderrescue-[a-z0-9]+-naminaone99s-projects\.vercel\.app$/;
const revision = /^[a-f0-9]{40}$/;

export function targetOrigin(value, { local = false, deployment = false } = {}) {
  let url;
  try { url = new URL(value); } catch { throw Error("Expected a valid deployment origin"); }
  if (url.username || url.password || (value !== url.origin && value !== url.origin + "/")) throw Error("Expected a bare origin");
  if (url.origin === production) return url.origin;
  if (local && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return url.origin;
  if (deployment && url.protocol === "https:" && !url.port && immutable.test(url.hostname)) return url.origin;
  throw Error("Unexpected OrderRescue deployment origin");
}

export function dispatchTarget(event, name, ref, sha) {
  if (event.repository?.full_name !== "NamiNaone99/orderrescue" || ref !== "refs/heads/main" || !revision.test(sha)) {
    throw Error("Smoke requires the trusted OrderRescue default branch");
  }
  if (name === "workflow_dispatch") return { url: targetOrigin(event.inputs.url), sha, ref: "main" };
  const p = event.client_payload;
  if (name !== "repository_dispatch" || event.action !== "vercel.deployment.success" ||
      event.sender?.id !== 35613825 || event.sender?.login !== "vercel[bot]" ||
      p?.project?.id !== "prj_VS2U4LEB98puXDf7aPTEFI0JPSV7" || p.project.name !== "orderrescue" ||
      !["preview", "production"].includes(p.environment) || p.state?.type !== "success" ||
      typeof p.git?.sha !== "string" || !revision.test(p.git.sha) || typeof p.git.ref !== "string") throw Error("Unverified Vercel deployment");
  const url = targetOrigin(p.url, { deployment: true });
  if (url === production && (p.git.ref !== "main" || p.environment !== "production")) throw Error("Invalid production target");
  // Only emit the known branch name or a constant. Never emit the event's ref as workflow syntax.
  return { url, sha: p.git.sha, ref: p.git.ref === "main" ? "main" : "preview" };
}

if (process.argv[2] === "--github-event") {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const target = dispatchTarget(event, process.env.GITHUB_EVENT_NAME, process.env.GITHUB_REF, process.env.GITHUB_SHA);
  appendFileSync(process.env.GITHUB_OUTPUT, `url=${target.url}\nsha=${target.sha}\nref=${target.ref}\n`);
}
