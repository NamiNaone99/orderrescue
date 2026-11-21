# Review the release after the guided tour

Maintain this plan under `.agent/PLANS.md`. The review records current architecture and regression evidence for release `5f3d48f`. Product owners decide separately whether to authorize changes.

## Purpose

A release owner can identify the reads, validation, call limits and transaction guarantees that a future Store projection or interpretation rule must preserve, and see which performance and accuracy questions still need measurements.

## Progress

- [x] 2026-11-21 14:13 +07:00. Fetched origin, read the proposal at `3efe88f` and identified the release and SPEC §§5–8 contract.
- [x] 2026-11-21 14:16 +07:00. Traced all four paths and passed lint, types, build, 297 unit cases, 51 in each time zone and seven Chromium cases.
- [x] 2026-11-21 14:17 +07:00. Verified the saved-receipt polling gap in Chromium and the guide's stricter version test on a changed unused row. The release owner received both findings.
- [x] 2026-11-21 14:18 +07:00. Recorded local counts and payloads, previous and current hosted samples and the release owner's eight-step production smoke in the task report and ledger.
- [x] 2026-11-21 15:25 +07:00. Rechecked CHAT, INSIGHTS, TOUR-F1 and T21 at `8411f1e`. Lint, types, build, 347 unit cases, 51 domain cases in each time zone and 12 local Chromium cases passed. Verified production transfer and smoke evidence with the coordinator.
- [x] 2026-11-21 15:36 +07:00. Re-read the fetched checklist after T17b and README-TH merged at `a431bed`. Verified an empty runtime diff from the tested release and linked the release PRs in the ledger.

## Surprises & Discoveries

T22 already measured the network boundaries on the hosted fixture. This review can reproduce counts from the local file and keep the historical transfer samples distinct.

The pristine local fixture reproduces T22's public bytes and hashes when using its simulated 2026 operational date. The source-retail date is in 2011. The latest hosted SKU had 20 reserved orders and five open.

## Decision Log

2026-11-21 14:13 +07:00, Codex. Use a local memory/offline production build for browser writes. Cite existing hosted evidence with its SHA; repository and unit checks can establish source-level continuity.

## Outcomes & Retrospective

The four proposed changes remain product and architecture decisions. Two presentation findings at the reviewed SHA were independently reproduced. The guide-only issue and the restored-stock display do not alter the reservation protocol. The current release, local and previous hosted runs are identified individually in the [review](../../docs/codex-log/architecture-post-ui.md).

TOUR-F1 closed both presentation findings. CHAT adds a stock-row grounding requirement for the proposed Interpret read and report-revision inputs for a future filtered Plan read. INSIGHTS confirms up to six read-only budget points and leaves the ordinary planning and reservation contracts intact.

## Steps and validation

From the checkout containing `package.json`, use Node 22 and pnpm 9. Run `git fetch origin`, then `git show origin/codex/architecture-review:docs/architecture-review/README.md`. Review SPEC §§5–8, ACs and the source for each proposal. Trace TOUR actions to desk handlers, use fixture counts only, and check version, stale refusal, replay and fallback against T22/T14. Compare code at both SHAs using `git diff --name-status 17a9dc5..HEAD`.

Run `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test:tz`, and a memory/offline build followed by `pnpm test`. Start the production server on loopback port 3244 and run the four requested Playwright files with `BASE_URL` pointing to it. An unrelated SKU revision may change the scenario digest; only relevant row/order changes should disable unbooked confirmation. A stale confirmed row receives 409, then an explicit replan may book #102 from B. A retry returns its original receipt. Document limitations and proposed decisions in `docs/codex-log/architecture-post-ui.md`; record integrated evidence in TOUR and the ledger.

## Retry and recovery

Rerun failed local checks against a fresh memory server after checking its health and ports. Stop the owned local process when finished. A missing hosted or live result remains unverified unless release evidence identifies the environment and scope.

## Revision history

2026-11-21 14:13 +07:00, Codex. Created a review-only plan and set reproducible acceptance checks.

2026-11-21 14:18 +07:00, Codex. Recorded baseline findings, release observations and independent regression results after the review.
