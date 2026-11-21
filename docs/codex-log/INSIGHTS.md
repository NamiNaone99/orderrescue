# INSIGHTS · Budget frontier and warehouse explanations

21 November 2026, started 14:26 ICT · local · GPT-6 · `tinsights-frontier-explanations` based on release `67350b7`. The request activated the S2/S3 stretch panels for the current incident. [ExecPlan](../../.agent/plans/INSIGHTS.md)

## What the dispatcher sees

Open **งบเท่าไหร่ ส่งทันกี่ออเดอร์** below the budget controls. The initial hero steps are ฿0 → 0/2, ฿32 → 1/2 and ฿88 → 2/2. The marked point shows the current plan, initially ฿100 and 2/2. The keyboard-operated slider changes the normal desk budget and produces the corresponding plan.

Open **ทำไมถึงเป็นแผนนี้** to see each order's deadline, each warehouse, the cost of its entire order line, and why that source was selected or passed over. Hero #101 takes B for ฿32; C is ready at 15:00, after its 14:00 deadline. Hero #102 takes C for ฿56 because #101 uses B's eight free units. After the B delay, an explicit replan shows #101 needs a person, and #102 uses B at 14:30 for ฿32. C can deliver #102 on time but would add ฿24. A remains blocked until 18:00.

[Desktop hero panels](../screenshots/insights-desktop.png) · [Phone budget chart](../screenshots/insights-mobile.png) · [Phone warehouse alternatives](../screenshots/insights-mobile-orders.png) · [After the B delay](../screenshots/insights-delay.png)

## How the evidence is generated

- The explanation uses a matched planning response and State snapshot. The existing planner and insight panel share the same effective-ready computation. A source switch releases only the current order's allocation, then checks stock net of commitments, the deadline, stock allocated to other orders and the budget left for this order. Prices and the final warehouse-ID tie-break explain otherwise feasible choices on a proven plan. A bounded result can name an unselected feasible alternative. [Source preparation](../../lib/planner/candidates.ts) · [Explanation and frontier calculations](../../lib/client/plan-insights.ts)
- Opening the chart queries the existing Plan endpoint at up to six additional budgets, sequentially. The collapsed panels send zero requests. Reopening a completed chart reuses its samples. A changed stock version or effective end discards the comparison. The separate CHAT field `effective_window_end`, when supplied, adjusts all source readiness and candidate costs. Probes still submit the original request window. [Panels](../../components/desk/plan-insights.tsx)
- For small instances, every possible whole-line cost sum is tested. The solid frontier is exact when all its budgets are proven. For larger instances, dashed steps and accompanying text describe attainable lower bounds. The seed real-day case with 21 affected orders sampled ฿0, ฿460, ฿919, ฿1,379, ฿1,838 and ฿2,298, yielding 9, 19, 20, 21, 21 and 21 on time. The last three returned `best_found`. Preparing the six budgets took 0.40 ms locally; each planning query retains the normal deterministic node cap.

## Verification

| Command or check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Used the locked dependencies. |
| `pnpm vitest run tests/client/plan-insights.test.ts` | Seven passed, including both hero breakpoints, delayed #101, shared budget, free stock, the warehouse tie, bounded sampling and an unchosen resumed source. The 13:15 resumption fixture admits one order at ฿0 and two at ฿32 while preserving the original 18:00 request end. |
| `pnpm lint`, `pnpm typecheck`, `pnpm test:tz` | Lint and typecheck passed. All 51 time-zone tests passed under UTC and all 51 under Asia/Bangkok. |
| `pnpm exec cross-env STORAGE_MODE=memory INTERPRETER_MODE=offline pnpm build`, then `pnpm exec cross-env STORAGE_MODE=memory INTERPRETER_MODE=offline pnpm test` | The production build generated all 13 static pages. 305 tests passed across 43 files, including the full planner property suite and browser-asset scan. Nineteen opt-in hosted tests were skipped. |
| `pnpm exec cross-env STORAGE_MODE=memory INTERPRETER_MODE=offline pnpm start --hostname 127.0.0.1 --port 3273`, then `pnpm exec cross-env BASE_URL=http://127.0.0.1:3273 pnpm e2e --reporter=line` | All 28 Chromium cases passed in 3.5 minutes on the final build. Tests cover keyboard budget changes, threshold labels, chart dimensions, cache reuse, snapshot drift, the normal hero booking, stale refusal, durable receipt polling and the guided tour. |
| Local production Playwright and axe capture on port 3274 | The pristine desktop and phone each performed one ordinary analysis and plan plus five chart probes. The delayed case used one ordinary analysis, two desk plans and three chart probes. All three produced zero bookings, zero page errors and zero WCAG 2.0/2.1 A/AA axe violations. The 1440 px and 390 px pages had no horizontal overflow. |

A first visual inspection found that the desk icon CSS sized the chart like an icon. The final chart measures 440 × 184 CSS px on desktop and 332 × 139 on the phone. A Chromium assertion now checks the chart's width and height. The normal hero, delayed hero and 390 px phone capture used local memory/offline mode. The release owner runs the production hero after merge.

At the reviewed base, CHAT was a separate branch. The resumption unit check supplied its agreed optional response field directly. A combined feed-event-to-insights check depends on the CHAT route being integrated.
