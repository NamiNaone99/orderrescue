# Test plan

Goal: every acceptance criterion in `SPEC.md` section 10 has an automated check or a named manual check, and the team can say truthfully which ran. All automated tests run with `STORAGE_MODE=memory` and `INTERPRETER_MODE=offline`, without network or secrets, unless marked live.

## 1. Tooling

- Vitest (`pnpm test`): `environment: 'node'` for `lib/**` and route-handler tests; `jsdom` only for component tests. Config `vitest.config.mts` with `vite-tsconfig-paths` and `@vitejs/plugin-react`.
- fast-check through `@fast-check/vitest` (`test.prop([...])`). Fixed seed in CI; print the seed on failure.
- Playwright (`pnpm e2e`, `pnpm smoke` = `playwright test --grep @smoke`), Chromium only, plus `@axe-core/playwright`.
- Scripts in `package.json`: `lint` (`eslint`), `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:tz`, `test:db`, `e2e`, `smoke`, `eval`, `eval:rows`, `try:interpret`, `data:build`. Scripts that need secrets load `.env.local` themselves (tsx and Vitest do not). `vitest.config.mts` aliases `server-only` to an empty stub so server modules load in tests.
- The laptops run Windows: environment variables are set through `cross-env` inside scripts or as `$env:NAME='value'` in PowerShell, never as `NAME=value command`.

## 2. Unit tests (`tests/`)

| File | Covers | AC |
|---|---|---|
| `domain/time.test.ts` | HH:MM parsing, `+07:00` handling, rounding, comparisons independent of machine time zone (`pnpm test:tz` runs the domain tests under `TZ=UTC` and `TZ=Asia/Bangkok`) | AC-27 |
| `domain/contracts.test.ts` | zod request schemas reject bad times, `start >= end`, qty <= 0, non-integers, negative budget, unknown keys | AC-27 |
| `planner/hero.test.ts` | First-come 1/2 THB 32; joint 2/2 THB 88; exact lines | AC-01, AC-02 |
| `planner/budget.test.ts` | 88 -> 2/2; 87 -> 1/2 (#101 via B, THB 32); 31 -> 0/2 | AC-03 |
| `planner/slip.test.ts` | B ready 14:30 -> 1/2, #102 via B, #101 needs human | AC-04 |
| `planner/commitments.test.ts` | Free = on hand - committed; committed 13 makes B infeasible | AC-05 |
| `planner/no-split.test.ts` | `hero-split` fixture never splits a line | AC-06 |
| `planner/tie.test.ts` | `hero-tie`: joint picks #202 via B at THB 16; swapping the two order ids still picks the 4-unit order | AC-07 |
| `planner/window-end.test.ts` | `hero-late-order`: order due 19:00 stays at A at cost 0 (joint 3/3 at THB 88); due 17:59 does not (2/3); a row with `ready_at` before `window_start` is NOT pushed to `window_end` | AC-08 |
| `planner/reasons.test.ts` | `needs_human` reasons for the hero cases listed in `SPEC.md` section 5, and `NO_ON_TIME_SOURCE` for `hero-split` | AC-01, AC-03, AC-04 |
| `planner/hash.test.ts` | Shuffled inputs give identical plan and `plan_hash` | AC-09 |
| `interpreter/validate.test.ts` | Rules V1-V8 one by one, including quote-not-substring and unknown SKU | AC-20, AC-21 |
| `interpreter/offline.test.ts` | Sample messages recognised; any other text clarifies | AC-19, AC-24 |
| `interpreter/chain.test.ts` | With a fake OpenAI client: primary error -> fallback; both fail -> offline; refusal; incomplete; timeout; `attempts` recorded | AC-23 |
| `interpreter/injection.test.ts` | Fake model returns an incident for an injected-instruction message with an unknown SKU or a non-substring quote -> clarification | AC-22 |
| `data/build.test.ts` | Runs the builder on a small committed sample CSV (`tests/fixtures/orii-sample.csv`, about 200 hand-picked rows of the raw file including cancellations and non-product codes): filters, merge, determinism (two runs byte-identical), invariants | AC-29 |
| `evals/file.test.ts` | Every eval row parses; `evidence_quote` is a substring; ids unique; both splits non-empty and every category present (counts printed, not fixed at 10/30) | AC-26 |

## 3. Property tests (`tests/planner/properties.test.ts`)

Generator: 1-6 orders and 2-3 warehouses for the oracle property (200 runs), a second oracle property of 20 runs with 7-8 orders, 1-40 orders in the scale property; `{ timeout: 60000 }` on the oracle properties; otherwise 2-4 warehouses, quantities 1-12, free stock 0-30, costs 0-9, ready times and deadlines on a 30-minute grid, budget 0-300, a window on the home warehouse.

| Property | AC |
|---|---|
| Joint equals the brute-force oracle on the full lexicographic objective (n <= 8), and reports `proven` | AC-11 |
| Joint on-time count >= first-come on-time count | AC-10 |
| Never allocates more than free stock per row | AC-05 |
| Total extra cost <= budget | AC-03 |
| Each order appears in at most one line, on one warehouse | AC-06 |
| Every allocated line is on time under the effective ready time | AC-08 |
| Output invariant under shuffling of orders, stock rows and warehouses | AC-09 |
| Raising the budget never lowers the on-time count (asserted only when both results are `proven`) | AC-03 |
| n up to 40: returns within the node limit, valid plan, labelled optimality; wall time asserted loosely (< 2 s in CI) | AC-12 |

The brute-force oracle lives in `tests/helpers/bruteForce.ts`, is written independently of `lib/planner` (ask Codex for it in a separate chat), and enumerates `(W+1)^n` assignments.

## 4. Store and booking tests (`tests/store/`)

One shared suite `storeContract(make)`, where `make()` returns `{ store, scenarioId }` and every test resets that scenario first. It runs against the memory store always (scenario `hero`), and against Supabase when `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are set (`pnpm test:db`, run by a human against the hosted project using scenario `hero-test`, never `hero` or `real-day`, and never during judging; otherwise skipped).

| Test | AC |
|---|---|
| Reserve changes exactly the submitted rows by exactly their quantities; revisions +1 on those rows only; orders become `reserved` | AC-13 |
| One stale line among two -> `STALE_STOCK`, zero rows changed | AC-14 |
| Insufficient stock, changed unit cost -> `STALE_STOCK`, zero rows changed | AC-14 |
| Same key and hash twice -> one reservation, second is a replay | AC-15 |
| Same key, different hash -> `IDEMPOTENCY_CONFLICT` | AC-15 |
| Order already reserved -> `ORDER_ALREADY_RESERVED` | AC-13 |
| Line with a qty different from the order line, or an unknown order -> `INVALID_INPUT`, zero rows changed | AC-13 |
| Two lines on the same stock row book in one reservation: `committed` rises by their sum, `revision` by exactly 1 | AC-31 |
| **Concurrency:** `Promise.all` of two reservations with different keys for the same 8 units -> exactly one success, one `STALE_STOCK`; repeated 50 times; `committed <= on_hand` after each | AC-16 |
| Concurrency: the same key sent 5 times in parallel -> one reservation, four replays | AC-15 |
| Demo event bumps the revision; applying twice is a no-op | AC-17 |
| Reset restores the seed exactly (deep-equal to a fresh snapshot) | AC-18 |

For Supabase the concurrency test is the proof that `reserve_plan` locks correctly; run it at least once against the hosted project and record the result in `docs/CODEX_LOG.md`.

## 5. Contract tests (`tests/api/`)

Call the route handler functions directly with `Request` objects.

- Each route: happy-path response parses with the shared zod response schema from `lib/domain/contracts.ts`.
- Each error code in `SPEC.md` section 9 (the error table, not the notices) is reachable and has the right status; `STORAGE_UNAVAILABLE` and `INTERNAL` are reached with a store stub that throws. Error bodies carry `request_id` and responses the `x-request-id` header.
- The two notices: an interpret response with a failed openai attempt and `used: offline`; a plan response with `affected: []`.
- `/api/plan` hero body returns the AC-01/AC-02 numbers.
- `/api/reservations`: tampered line (changed warehouse) -> `PLAN_HASH_MISMATCH`; over budget -> `OVER_BUDGET`; the plan lines from `/api/plan` reduced to the six request fields book successfully (the hash matches).
- `/api/demo/reset`: `hero` without a token -> 200; `real-day` or `{}` without or with a wrong token -> 401.
- `/api/interpret`: 501-character message -> 422; with a limiter constructed with burst 2 (or `INTERPRET_BURST=2`) and the route in openai mode with a fake client, the third call is answered offline with `rate_limited: true` and no 429; in offline mode the limiter is skipped.
- `lib/ratelimit.ts` unit test: a bucket built with burst 2 and a fake clock refuses the third call and refills.
- `/api/health` shape (including `model` and `degraded`).
- With T21 part 2: `/api/plan` over its bucket -> 429; a body over 16 KB -> 413.

## 6. Interpreter evaluation (`pnpm eval`)

Spec in `DATA_PLAN.md` section 6.

- `pnpm eval` runs the offline interpreter over all rows (free, deterministic; expected to score low on everything except the sample messages, which is the point of the comparison).
- `pnpm eval --live --split dev` while tuning the prompt. `pnpm eval --live --split heldout` for the reported number; run it at most twice (once after tuning, once before the freeze) and keep both result files.
- **Pass threshold (AC-26):** false incidents = 0; kind accuracy >= 90% (27/30); exact field match on incident rows >= 80%. The script exits non-zero below threshold or when rows were skipped (unregistered scenario). With fewer than 30 held-out rows, report counts, not pass or fail.
- The live run needs T11 and T13 merged (the rows use the `real-day` SKU list).
- If it fails: fix on dev rows only, re-run held-out once, report the real numbers. Do not edit held-out labels after the first live run except to correct a labelling error agreed by two members, logged in `docs/CODEX_LOG.md`.
- Also record p50/p95 latency and how often the fallback model answered.
- Not part of CI (needs a key). A manual `workflow_dispatch` job may run it with the `OPENAI_API_KEY` secret.

## 7. End-to-end (`e2e/`)

One Playwright config. `baseURL = process.env.BASE_URL ?? 'http://localhost:3000'`. `webServer: { command: 'pnpm build && pnpm start', url: 'http://localhost:3000', reuseExistingServer: !process.env.CI, timeout: 120000 }` only when `BASE_URL` is unset. When `VERCEL_AUTOMATION_BYPASS_SECRET` is set, send `x-vercel-protection-bypass` and `x-vercel-set-bypass-cookie: true`. Every spec starts by calling `/api/demo/reset` for its scenario (with `DEMO_RESET_TOKEN`, default `local-token`).

`workers: 1` and `fullyParallel: false` (all specs share one demo state and reset it, so they must run serially); once per-visitor workspaces exist (stretch S0), each spec may use its own `ws` and run in parallel. The webServer block sets `env: { STORAGE_MODE: 'memory', INTERPRETER_MODE: 'offline', DEMO_RESET_TOKEN: process.env.DEMO_RESET_TOKEN ?? 'local-token' }` so local e2e never touches OpenAI or Supabase regardless of `.env.local`; `e2e/helpers.ts` uses the same default token.

Task column: T07 `home`; T10a `hero`; T16 `stale`; T17a `budget`, `clarify`, `idempotent`, `health`; T17b `sku-choice`, `real-day`, `pages`, `a11y`, `mobile`; stretch S11 `errors` and the extended rows.

| Spec | Steps | Tag | AC |
|---|---|---|---|
| `hero.spec.ts` | Open `/`; Analyse; see incident A / SKU-X / 13:00-18:00; see 1/2 and 2/2, ฿32 and ฿88; Confirm; dialog lists #101 from B and #102 from C; confirm; receipt; stock panel shows B and C free 0; no stale banner appears within 6 s after the receipt | `@smoke` | AC-01, 02, 13, 19 |
| `stale.spec.ts` | Plan; trigger event `b-slips-1430`; stale banner; Confirm disabled; Replan; 1/2 with #102 via B | `@smoke` | AC-04, 17 |
| `budget.spec.ts` | Budget chips 88, 87, 31 give 2/2, 1/2 (#101), 0/2 | | AC-03 |
| `clarify.spec.ts` | Ambiguous sample -> clarification card, no plan; manual form -> plan | | AC-20 |
| `sku-choice.spec.ts` | Real-day two-SKU sample; choose the second SKU; re-analyse; choice kept (skipped with a reason when `real-day` is not registered) | | AC-25 |
| `idempotent.spec.ts` | Double-click confirm (and a repeated request with the same key through `request`) -> one reservation | | AC-15 |
| `real-day.spec.ts` | Switch scenario; sample message; plan renders with affected count > 10; data badge says real orders + simulated warehouses (skipped with a reason when `real-day` is not registered) | | AC-12, 29 |
| `pages.spec.ts` | `/data` shows source, licence and the field table; `/built-with-codex` asserts only the heading when the log table is absent | | AC-29 |
| `a11y.spec.ts` | axe on desk (planned) and the confirm dialog: zero violations. Stretch S11: also the stale state, the booked state, a mobile viewport, `/data`, and a keyboard-only run of the hero path | | AC-30 |
| `mobile.spec.ts` | 390x844 viewport: hero path, no horizontal scroll (`scrollWidth <= clientWidth`). Stretch S11: also in the Playwright `webkit` project (install `webkit` in CI) | | AC-30 |
| `errors.spec.ts` (stretch S11) | Unknown route shows the not-found page; a forced 500 from a stubbed `/api/plan` shows the inline alert with Retry and keeps the last good data; a stubbed 429 shows the rate-limit text and the manual form works | | AC-30 |
| `home.spec.ts` | Home page loads with status 200 and has a title | `@smoke` | AC-30 |
| `health.spec.ts` | `/api/health` ok and has `commit` | `@smoke` | AC-30 |

Against the live URL the interpreter may be the real model. Assertions on the hero message must hold for both live and offline (same structured result). Do not assert latency.

## 8. Security checks

- `tests/security/bundle.test.ts` (after `pnpm build`): no file under `.next/static` matches `/(^|[^A-Za-z0-9_-])sk-(proj-|svcacct-)?[A-Za-z0-9_-]{20,}/` or `/sb_secret_[A-Za-z0-9_-]{8,}/`, or contains the literal strings `OPENAI_API_KEY`, `SUPABASE_SECRET_KEY` or `DEMO_RESET_TOKEN`; when those env vars are set in the test process, their values must not appear either (AC-28). The bare substring `sk-` is not tested: CSS such as `mask-` contains it.
- `git grep -nE "(^|[^A-Za-z0-9_-])sk-(proj-|svcacct-)?[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9_-]{8,}"` returns nothing (also in CI; the same pattern as task T07, written so that these documents and words such as `task-` do not match).
- The Owner turns on GitHub secret scanning and push protection for the repository at 10:00.
- Rendering: no `dangerouslySetInnerHTML` anywhere (`git grep dangerouslySetInnerHTML` returns nothing).
- Manual: open DevTools Network on the live site; only same-origin `/api/*` calls.

## 9. CI (GitHub Actions)

`.github/workflows/ci.yml`, on `push` and `pull_request`, Node 22, pnpm from the `packageManager` field:

1. `actions/checkout`, `pnpm/action-setup`, `actions/setup-node` with `cache: pnpm` (check the current major versions).
2. `pnpm install --frozen-lockfile`
3. `pnpm lint`, `pnpm typecheck`, `pnpm test`
4. `pnpm exec playwright install --with-deps chromium`, `pnpm e2e`
5. `pnpm vitest run tests/security --passWithNoTests` (the build from the e2e step exists by now)
6. The secret-pattern `git grep` from section 8.
7. Upload the Playwright report on failure.

Env: `INTERPRETER_MODE=offline`, `STORAGE_MODE=memory`, `DEMO_RESET_TOKEN=ci-token`. No secrets, no API spend.

`.github/workflows/e2e-deployed.yml`: `on: repository_dispatch: types: ['vercel.deployment.success']` plus `workflow_dispatch` with a `url` input; checks out `github.event.client_payload.git.sha`; runs `pnpm smoke` with `BASE_URL` set to the deployment URL; secrets `DEMO_RESET_TOKEN` and, if protection is on, `VERCEL_AUTOMATION_BYPASS_SECRET`. It only triggers once the file is on `main`.

No required-check branch rule: the light review tier merges on local checks without waiting for CI (`CODEX_TASKS.md`, "How to run a task"). If CI is red on `main` for more than 10 minutes, the person who merged last fixes it first.

## 10. Live smoke test

PowerShell: `$env:BASE_URL='https://<app>.vercel.app'; $env:DEMO_RESET_TOKEN='<token>'; pnpm smoke` runs `home`, `health`, `hero` and `stale` (about 30 s), resetting the hero scenario first and last. Run it after every production deploy, at 16:30, and before each judging rotation (never while a judge is using the site: the reset wipes the shared hero state). While production storage is memory, a single failure caused by lost state is expected; reset and retry once (`DEPLOY_PLAN.md` section 5).

## 11. Manual checks (10 minutes, at 15:45 and 16:30)

- Private window on a phone over mobile data: site opens without login, hero path works.
- Projector resolution 1280x720: first-10-seconds view fits without scrolling.
- Turn Wi-Fi off on the fallback laptop: `pnpm dev` in memory + offline mode still runs the hero path.
- Paste an injected-instruction message into the live site: no incident, no booking.
- Two browsers confirm the same plan at the same time: one receipt, one stale refusal.
- iPhone Safari and Android Chrome on mobile data: hero path.
- Keyboard only: hero path from the message to the receipt (this replaces the automated run if T17b is cut).
- Lighthouse (mobile) on production once: record the Performance and Accessibility scores in `docs/CODEX_LOG.md`; fix anything under 90 only if it takes under 10 minutes.

## 12. Pre-freeze checklist (16:30-17:00)

Last merge to `main` 16:30. No pushes after 16:30 except a rollback. Submit by 16:50.

- [ ] `main` is green in CI. No open PR that is meant to be included.
- [ ] Production deployment is from the latest `main` commit; `/api/health` shows that commit, `storage` and `interpreter` as intended.
- [ ] `pnpm smoke` passes against production. Result noted in `docs/CODEX_LOG.md`.
- [ ] Held-out eval result file committed (or README says the live run was not done); numbers and row counts in README match the file.
- [ ] Supabase concurrency test result recorded, or README states storage is memory.
- [ ] Demo reset run; desk shows the first-10-seconds view.
- [ ] README: what it is, live URL, how to run, tests that ran (with real counts), data attribution, limitations, "How we used Codex".
- [ ] `docs/CODEX_LOG.md` complete; `docs/codex-log/` exports committed.
- [ ] No secrets in the repo (`git grep` check); `.env.example` current.
- [ ] OpenAI budget set. (The firewall rate-limit rule is optional.)
- [ ] If production storage is memory: the fallback laptop is built and is the default for round one (`DEPLOY_PLAN.md` section 9).
- [ ] Backup video file on two laptops and a phone.
- [ ] Submission sent in the required format (first version by 16:30 where allowed, final by 16:50); confirmation screenshot saved.
- [ ] Nobody pushes after the submission. Tag the commit: `git tag freeze-1700 && git push --tags` (before 17:00).
