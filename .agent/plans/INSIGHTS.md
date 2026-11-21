# INSIGHTS · Compare budgets and explain individual warehouse choices

Maintain this plan under `.agent/PLANS.md`.

## Purpose

On a displayed joint plan, a dispatcher can open two optional panels. One compares on-time orders over budgets and marks the current one. The other explains each warehouse choice and rejection using ready times, commitments, quantities and cost observed when the plan was made. The hero chart must rise at ฿32 and ฿88.

## Progress

- [x] 2026-11-21 14:26 +07:00. Read AGENTS, S2/S3, UI_SPEC and the existing planning, Store-to-client and desk paths. Reserved a separate worktree.
- [x] 2026-11-21 14:34 +07:00. Implemented opt-in budget reads, deterministic reason templates, responsive panels and support for the optional effective outage end from CHAT.
- [x] 2026-11-21 14:45 +07:00. Verified original, delayed and resumed-source cases, captured four desktop/phone images and passed 305 unit tests and all 28 Chromium tests.

## Surprises & Discoveries

The public Plan includes the six-field joint rows and affected-order list. Its paired public State read includes the stock needed to explain each warehouse. The existing budget editor accepts integer THB and triggers a debounced plan.

The shared desk icon rule initially reduced the chart to 16 px. A screenshot exposed it. The chart now has its own dimensions and Chromium asserts its rendered size. The delayed #102 can also use C at an extra ฿24 compared with B; the panel reports that actual price difference.

## Decision Log

2026-11-21 14:26 +07:00, Codex. Make insights opt-in, use existing Plan and State contracts, restrict frontier probes to six distinct additional budgets per snapshot and show when only sampled budgets are known. Keep receipts and booking untouched. For a candidate blocked by stock assigned elsewhere, describe the assignment explicitly. A feasible unchosen alternative needs its own honest label.

2026-11-21 14:34 +07:00, Codex. The plan can report an effective end after picking resumes. Use it for all warehouse comparisons and use the original incident in budget-probe requests. A mock interrupted read demonstrates that a version change discards every partial result. T14's exhaustive solver checks cover extraction of the shared effective-ready rule.

## Outcomes & Retrospective

The default hero has proven gains at ฿32 and ฿88. The delayed hero gains a single on-time order at ฿32. Three full-page axe scans found zero violations. Both panels used zero extra interpreter calls or bookings. The release owner verifies production after merge. [Local evidence and limits](../../docs/codex-log/INSIGHTS.md)

## Steps and validation

From the repository root, use Node 22 and the locked pnpm dependencies. Reuse the planner's effective ready-time rule. Calculate explanatory alternatives using total and residual stock and remaining joint budget; separate hard constraints from a feasible alternative. Find candidate-cost breakpoints on small inputs and sample larger inputs with a fixed bound. Ask the existing read-only Plan route for budgets, stop on version drift and expose a retry for request errors. A slider drives the normal budget editor. Tests exercise the hero, slip, low budget, a legitimate alternative and bound behaviour.

Run `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`. In a production server started on loopback in memory/offline mode, run all Chromium cases including the two panels. Check keyboard operation, axis/current-budget labels and small widths. Capture desktop and phone evidence. Record results in `docs/codex-log/INSIGHTS.md`. The release owner runs the post-merge deployed hero smoke.

## Retry and recovery

Abort outstanding comparisons when the plan changes or the panel unmounts. Stale samples are discarded. Re-run browser checks on the isolated memory server to restore the hero without hosted state changes.

## Revision history

2026-11-21 14:26 +07:00, Codex. Established panel boundaries and acceptance checks.

2026-11-21 14:45 +07:00, Codex. Recorded final WCAG, screenshot, unit and browser evidence against the integrated TOUR-F1 base.
