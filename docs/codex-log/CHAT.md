# CHAT. Replan from confirmed warehouse messages

21 November 2026 · Started 14:27 ICT · Codex local, Windows · gpt-6.2-astra

Added a warehouse conversation to the dispatch desk. An outage starts a plan. A delay, newly found stock or resumed picking produces a proposal showing the location, SKU, time or quantity, and the quoted message. The operator must confirm before stock changes. Receipts keep their original rows.

## Implementation

The feed shows the sender and Bangkok receipt time, supports a typed message and offers three synthetic follow-ups on the hero scenario. A sender selection is display metadata. The interpreter must find the reported warehouse in the text. Chat text stays in the current page session. The database retains structured event facts and their UUID for replay.

The existing outage interpreter remains available. A chat context on `POST /api/interpret` selects an extended strict provider schema. Follow-up validation checks the quote, the complete message, the known stock row, and whether the value is explicit. A delay with no stated SKU uses the active incident's SKU or a uniquely available scenario SKU. Found stock requires an explicitly identified SKU and 1–10,000 additional units. A resumption must match the active warehouse, SKU and outage window. Ambiguous scope, conflicting counts or clocks, negation, and unsupported dates lead to clarification.

`POST /api/chat/apply` validates the evidence again and applies the operator-confirmed report through the selected Store. Both stores reject reuse of a key for different facts. The transaction advances the affected row revision. A report concerning an unused stock row can invalidate a plan with zero allocations. The planner uses the confirmed end of a resumed outage. The hash and reservation still use the original incident and the exact six fields the operator confirms.

The additive migration creates `warehouse_reports`, `scenario_report_snapshots`, and the security-invoker `apply_warehouse_report` function. The previous snapshot view and reset RPC stay usable by the deployed application. The new table has RLS enabled and the new view, table and RPC grant access only to the service role among the API roles. The migration does not seed or mutate existing rows. SHA-256 `0135e3a37c400453447704c90a99cfc2f21a06590c4f5e353cb5591122d51390`. [Supabase database functions](https://supabase.com/docs/guides/database/functions) · [Row level security](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Verification

| Command or check | Observed result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Installed the committed dependencies. |
| `pnpm dlx supabase migration new warehouse_reports` | Generated the migration in the worktree. |
| `pnpm lint`, `pnpm typecheck`, `pnpm build` | Passed. Next.js generated 14/14 static entries and registered the new dynamic confirmation route. |
| `pnpm vitest run tests/store/memory.test.ts tests/interpreter/chat.test.ts tests/api/warehouse-chat.test.ts` | 55 passed, including all three event types, exact evidence, clarification, typed real-day scope, replay, rollback, stale detection and the two preset/report orderings. |
| `pnpm test` after integrating INSIGHTS and building | 341 passed across 45 files in 7.69 s. The 22 opt-in hosted contracts were skipped. The client bundle scan ran against the build. |
| `pnpm test:tz` | 51 domain tests passed in UTC and 51 in Asia/Bangkok. |
| Local PostgreSQL 18.7, five independent sessions | The migration preserved snapshots of all three seeded scenarios. Three operations and replays, a conflicting key, six invalid payloads, row deltas, reset isolation, access grants and RLS passed. All 20 concurrent five-request stock reports produced one creation and four replays. Across 20 concurrent predefined delays and later chat delays, the final ready time was always 15:15. |
| Supabase JavaScript Store against local PostgreSQL through a temporary HTTP-transport substitute | All 22 shared Store contracts passed in 1.53 s. This exercised the service-role SQL and adapter in the isolated local cluster. The hosted PostgREST gateway was outside this run. |
| `pnpm e2e e2e/warehouse-chat.spec.ts --reporter=list` | Chromium analysed a pasted outage, showed 2/2, previewed the delay without applying it, waited for confirmation, showed the stale plan, then replanned to 1/2. |
| `pnpm e2e --reporter=line` against the integrated production build | All 29 Chromium tests passed in 3.6 minutes, including the four smoke tests, receipt polling, the guided demo, warehouse chat, order explanations and the budget frontier. |
| Additional serial Chromium checks on an independent memory/offline process | C found four units, replan 2/2 at ฿88. B was delayed to 14:30, replan 1/2 at ฿32. A resumed at 13:30, replan 2/2 at ฿0 with both orders at A. Both order explanations showed A at 13:30 and the budget frontier showed 2/2 at ฿0. No browser errors. No document overflow or axe WCAG 2.0/2.1 A/AA findings in the panel at 1440×900 or 390×844. |

[Desktop chat](../screenshots/warehouse-chat-desktop.png) · [Mobile chat](../screenshots/warehouse-chat-mobile.png)

## Live interpretation and deployment handoff

The coordinator exercised the local memory-backed interpret route with live OpenAI. The first attempt returned a valid clarification for the supplied B departure phrase. The revised prompt identifies a reported departure time as a delay and tells the provider whether an active SKU exists. It sends no SKU value, inventory or order data in these contextual instructions.

The coordinator's repeat produced three HTTP 200 proposals on the first `gpt-6-luna` attempt, each with zero validation issues. Delay returned B/SKU-X at 14:30 in 2,589 ms, found stock returned C/SKU-X +4 in 2,481 ms, and resumed returned A/SKU-X at 13:30 in 2,334 ms. The calls were read-only and used synthetic hero messages.

The coordinator owns hosted migration application, merge and production Playwright verification on the synthetic hero. The new 22-case hosted contract is opt-in and has not been run. T15's historical hosted result covers its original 19 cases.

## Post-merge production verification

After [PR #27](https://github.com/NamiNaone99/orderrescue/pull/27) merged at `7e5b1cc`, the coordinator verified the synthetic hero on the live desk. Health reported Supabase storage and OpenAI interpretation. The hosted `warehouse_reports` migration was recorded as `20261121080720`. Its table had row-level security and zero reports at migration. The report reads and RPC were restricted to the service role among the API roles. The original and new snapshots matched for all three scenarios.

| Operator action | Observed result |
| --- | --- |
| Book the ordinary joint hero plan | First-come served 1/2 for ฿32. Joint served 2/2 for ฿88. The reservation returned HTTP 201 with receipt `2c7e897a-72c9-456e-8ec2-0fbd30349f88` for #101/B ×8 and #102/C ×8. |
| Report **รถสาขา B ออกได้บ่ายสองครึ่ง** | The preview showed 14:30 and stock stayed unchanged until confirmation. The confirmed report returned HTTP 200 and disabled booking of the stale plan. Replanning served 1/2 for ฿32. |
| Report four additional SKU-X units at C | Confirmation changed C's quantity from 8 to 12. Replanning served 2/2 for ฿88. |
| Report that A resumed picking at 13:30 | Replanning served 2/2 for ฿0. The #101 explanation displayed `คลัง A · เลือกคลังนี้ · พร้อม 13:30 · ฿0`; the frontier showed `฿0 · 2/2`. |

All three reports used `openai:gpt-6-luna`. Each preview left stock unchanged, each confirmation returned HTTP 200, and the desk blocked booking of the stale plan. Cleanup restored the hero's open orders and initial stock revisions, with zero reservations remaining.
