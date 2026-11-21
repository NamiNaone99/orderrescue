# TOUR-F1 · Keep restored bookings and their live stock consistent

## Purpose

After reloading a saved receipt, a dispatcher can see another operator’s stock changes within the normal five-second interval. The published receipt keeps its original lines and total. A plan that is still valid after an unrelated stock change can advance the guide after the explicit replan.

## Progress

- [x] 21 Nov 2026 14:15 ICT. Read the desk, tour, public state, store filters and SPEC §8.2. Installed the frozen lockfile and read the installed Next.js client and Playwright guides.
- [x] 21 Nov 2026 14:19 ICT. Reproduce both issues on the original local memory/offline build, including a real booking and changed stock.
- [x] 21 Nov 2026 14:21 ICT. Extend the existing visible-tab poll and use the same affected-row semantics as the desk for guide progression.
- [x] 21 Nov 2026 14:25 ICT. Both focused browser tests passed, followed by 298 unit and 26 Chromium checks. Inspected the restored receipt and stock at both sizes.

## Decision log

Use a single abortable GET loop. A receipt poll uses the SKU shown by the panel, including receipts on a non-default SKU. Keep receipt evidence independent from later stock updates. A replan must have completed since the warehouse delay before the coach advances.

## Validation and recovery

Use loopback port 3231, memory storage and offline interpretation. Create an actual receipt, reload, then change the warehouse ready time using the existing local event endpoint. Check visible stock, unchanged receipt, no additional client writes, and hidden/idle cleanup. Exercise an unrelated change between the planner and its following state read. Run lint, typecheck, Vitest, production build and Playwright. Repeated local runs can seed hero using the existing e2e helper.

## Outcomes and revision history

21 Nov 2026. Initial plan on `5f3d48f`.

21 Nov 2026 14:25 ICT. The original production binary failed on the stale 13:30 time and the stalled seventh step. The repaired production build passed all 26 browser checks. See the task log for real booking and viewport evidence.
