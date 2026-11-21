# TOUR · Guided dispatch walkthrough

21 November 2026, 13:39–14:04 ICT · GPT-6 · local worktree `tour-guided-demo` · integrated base `5f009f9`

## What the presenter can do

Choose **เริ่มสาธิต / Start demo** in the header or open `/?tour=1`. Either entry requests the existing hero reset once. Open `/?tour=1&notes=1` to show a speaking line from the pitch and a clock. The existing read-only desk guide remains available.

Eight Thai-first callouts follow the real message, extracted evidence, deadlines, two plans, warehouse delay, replan and receipt. Figures come from the current desk response. At a state-changing step, the presenter can use the highlighted control or **ทำให้ฉัน / Do it for me**. Reviewing and submitting the booking take separate actions. The coach follows the result of each action, including when the operator uses the desk directly.

Right or Enter moves forward, Left goes back, period performs the real action, and Escape leaves the desk in its current state. Native editing keys still work in inputs. The booking dialog keeps control of its own keyboard focus. The receipt's public reference travels in the URL. Reloading the tour resolves its lines, total and stock using the existing state endpoint. Finish offers to keep the booking or explicitly reset hero for the next presentation.

## Evidence

Before implementation the coordinator ran the official browser against production commit `5b6b055` with healthy Supabase and live OpenAI. The first-come result was 1/2 at ฿32, joint was 2/2 at ฿88, and delaying B from 13:30 to 14:30 produced the stale banner. Replanning kept #102/B × 8 at ฿32 and sent #101 to the operator. Booking returned HTTP 201 with reference `e08cbb4c-f026-41b1-9335-e2fe32f29b60`. The CSV downloaded and the coordinator restored hero.

The local production build ran in memory/offline mode on port 3230. Desktop and phone each submitted one actual booking and one hero-only reset. The desktop receipt was `14aaf83d-9658-40bf-b96a-bb730a3a2cd9` and the phone receipt was `3c9876f9-2dc5-40e8-ac3c-8380ed3f22e8`. Each reported #102/B × 8, ฿32 and zero free units at B. Reload returned the same reference and CSV filename. At step five, changing the actual budget to ฿31 updated the coach to 0/2 at ฿0. Restoring ฿100 returned it to 2/2 at ฿88.

The desktop receipt measured 883px wide and the phone receipt measured 358px. Both fit their contents after reload. The restored desk keeps the confirmation step current and marks the warehouse that supplied the booking. At 390px the two order deadlines are visible together and scrolling 161px reveals the rest of the second order card. All eight callouts kept focus and their spotlighted control remained outside the callout. Thai body text measured 19px on desktop and 18px on phone. Four axe scans at each size covered the message, joint plan, native confirmation and receipt, with zero WCAG 2.0/2.1 A/AA violations reported. No browser page errors occurred during those runs.

The recovery pass exercised a refused reset and subsequent reload, typing a period in the textarea, unexpected clarification, a failed replan and retry, a double-click while opening the booking dialog, and keyboard exit with the native dialog still usable. A local test replaced a real committed HTTP 201 response with 503. Retrying sent the same booking body and idempotency key and recovered the original receipt. A missing receipt retried the read only. Finish/reset returned B to eight free units.

| Step | 1440 × 900, presenter notes on | 390 × 844, notes hidden |
| --- | --- | --- |
| 1. Warehouse message | [Desktop](../screenshots/tour-01-message-desktop.png) | [Phone](../screenshots/tour-01-message-mobile.png) |
| 2. Interpreted incident | [Desktop](../screenshots/tour-02-incident-desktop.png) | [Phone](../screenshots/tour-02-incident-mobile.png) |
| 3. Affected orders | [Desktop](../screenshots/tour-03-orders-desktop.png) | [Phone](../screenshots/tour-03-orders-mobile.png) |
| 4. First-come plan | [Desktop](../screenshots/tour-04-first-come-desktop.png) | [Phone](../screenshots/tour-04-first-come-mobile.png) |
| 5. Joint plan | [Desktop](../screenshots/tour-05-joint-desktop.png) | [Phone](../screenshots/tour-05-joint-mobile.png) |
| 6. Warehouse B delay | [Desktop](../screenshots/tour-06-delay-desktop.png) | [Phone](../screenshots/tour-06-delay-mobile.png) |
| 7. Stale plan and replan control | [Desktop](../screenshots/tour-07-replan-desktop.png) | [Phone](../screenshots/tour-07-replan-mobile.png) |
| 8. Committed receipt | [Desktop](../screenshots/tour-08-receipt-desktop.png) | [Phone](../screenshots/tour-08-receipt-mobile.png) |

## Commands and results

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Installed the checked-in dependency versions. |
| `pnpm lint` | Passed. |
| `pnpm typecheck` | Passed. |
| `pnpm test` | 294 passed. The existing 19 opt-in database checks were skipped. Includes three tour state-machine tests. |
| `pnpm exec cross-env STORAGE_MODE=memory INTERPRETER_MODE=offline pnpm build` | Passed, including all 13 static pages. |
| `pnpm exec cross-env STORAGE_MODE=memory INTERPRETER_MODE=offline pnpm start --hostname 127.0.0.1 --port 3230` | Started the local production server. |
| `pnpm exec cross-env BASE_URL=http://127.0.0.1:3230 pnpm e2e --reporter=line` | 24 Chromium checks passed in 2.5 minutes. |
| Local Playwright capture and recovery passes | Completed the native-control tour and receipt reload at both sizes, checked the budget and failures above, and visually reviewed all 16 PNGs. |

The coordinator owns PR integration and the post-merge production tour.
