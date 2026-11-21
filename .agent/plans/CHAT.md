# CHAT — Apply warehouse follow-ups and replan

## Purpose

An operator can analyse an outage, read subsequent warehouse messages, review a proposed change and explicitly apply it. The current plan becomes stale and the existing Replan control uses current stock and availability. An unrelated, ambiguous or ungrounded message only asks for clarification.

## Progress

- [x] (2026-11-21 14:27 +07:00) Read the interpreter, stock store, planner, desk and project rules. The chat request extends the original three interpretation outcomes and existing preset-only demo button.
- [x] (2026-11-21 14:35 +07:00) Implemented three typed follow-ups and the backward-compatible outage outcome. Validated the evidence against the full message and resolved the omitted SKU only from an unambiguous scenario or active incident.
- [x] (2026-11-21 14:44 +07:00) Verified the forward migration and all three operations on native PostgreSQL 18.7. Twenty five-connection races each produced one addition. Twenty concurrent preset/report races preserved the later departure. Sent the final migration hash to the coordinator.
- [x] (2026-11-21 14:53 +07:00) Passed the complete Chromium suite on TOUR-F1, then integrated INSIGHTS at `5a1653c`. Retained both desk panels and the effective outage end supplied to explanations and frontier probes. Added both task rows to the common ledger at the coordinator's request.
- [x] (2026-11-21 15:01 +07:00) Verified chat on the integrated production build. Lint, typecheck, build, 341 unit tests, 51 domain tests in each timezone and all 29 Chromium tests passed. On desktop and phone the chat had no axe violations or horizontal overflow. After resumption the explanations and budget frontier matched the plan at 2/2 for ฿0.

## Starting point and decisions

The existing interpreter emits an incident, clarification or ignore. The initial outage remains compatible with existing clients. Follow-ups carry structured warehouse, SKU scope, time or quantity and exact evidence. A dedicated confirmation route revalidates the reported facts against the message. Both stores accept the same typed, idempotent operations. The planner still receives one outage window and a stock snapshot. A reported resumption trims that window when its warehouse, SKU and time match. Chat text stays in the current desk session. The existing demo event button remains available.

## Milestones and validation

Use `pnpm install --frozen-lockfile` in the chat worktree. Add schema, evidence, retry and replay checks for stock found, delay and resumption. A local PostgreSQL instance exercises the new migration without hosted credentials. Verify the hero outage serves 2/2, that interpreting a delay keeps the plan current until confirmation, and that applying it makes the plan stale and replanning serves 1/2. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm e2e`, and targeted browser accessibility checks with memory/offline inputs.

## Recovery and handoff

Retries use the same event ID. The transaction must return its previous outcome for the same report, and refuse a different report with the same ID. A reset restores the demo seed. The coordinator handles hosted migration, deployment and verification; the feature branch uses local services.

## Discoveries and outcome

TOUR-F1 merged while the feature was in progress. Integrated main `67350b7` and retained its five-second restored-receipt stock poll. A separate report revision identifies a newly useful stock row even when neither planning strategy chose that row. A matching resumption sets an optional effective end time on the plan response. The caller still confirms and hashes the original incident. The old preset button becomes applied when a later confirmed report covers its fixed delay.

The first live preflight reported a clarification for the required departure message. The coordinator repeated it after the prompt distinguished an update from an outage and told the provider only whether there was an active selected SKU. All three follow-ups returned the correct event on the first live model attempt using a local memory snapshot.

## Revision history

21 November 2026, 14:27 ICT. Created before implementation after inspecting the existing flow. At 14:46, updated local database, live interpretation and integration evidence.
