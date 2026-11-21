# TOUR-F1 · Keep receipt inventory live after reload

21 Nov 2026 · 14:15–14:25 ICT · Codex local · GPT-6 · base `5f3d48f`

## Findings and changes

On the original local production build, an operator booked a two-line hero receipt and reloaded it. A second operator moved B from 13:30 to 14:30 using the existing event endpoint. The receipt desk still showed 13:30 after eight seconds. It now uses the same visible-tab, five-second polling loop as the active plan, even when no plan remains in memory. A receipt poll can update stock, the observed state version and applied demo events. The receipt retains its original reference, lines, total and timestamp.

The stock panel and request use the selected SKU if it appears on the receipt. On a fresh reload they use the first booked line's SKU. Every historical line stays visible. An idle desk or a missing receipt starts no polling loop. Hiding the tab cancels the active read; returning fetches immediately. A slow read cannot overlap the next scheduled read, and unmounting clears the interval.

A separate regression reproduced a valid post-delay replan stuck on step seven. The whole scenario version changed on unused A even though the plan still used B and the affected orders remained open. The coach now checks that a completed plan's baseline includes the delay and the desk considers its actual rows and orders current. A stale or in-flight plan still blocks progress.

## Local verification

The original production binary failed both browser assertions. The repaired binary passed both in 11.4 seconds. The receipt test checked HTTP 201, two original lines, the eventual public 14:30 time, unchanged receipt contents, zero stale banners and no browser POST after reload. The full tour reached step eight with an unrelated A revision between the real planner response and the next state read. A controlled-clock hook test also covered idle, hidden and unmounted screens; slow reads; omission of the historical reservation in a newer snapshot; and a receipt with two distinct SKUs from the real-day fixture. No hosted changes were made.

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed. |
| `pnpm lint` and `pnpm typecheck` | Passed. |
| `pnpm test` | 298 passed, 19 opt-in database checks skipped. |
| `pnpm exec cross-env STORAGE_MODE=memory INTERPRETER_MODE=offline pnpm build` | Local production build passed. |
| `pnpm exec cross-env STORAGE_MODE=memory INTERPRETER_MODE=offline pnpm start --hostname 127.0.0.1 --port 3231` | Served the local production build. |
| `pnpm exec cross-env BASE_URL=http://127.0.0.1:3231 pnpm e2e e2e/receipt-refresh.spec.ts e2e/tour.spec.ts --reporter=line` | Both focused browser checks passed. |
| `pnpm exec cross-env BASE_URL=http://127.0.0.1:3231 pnpm e2e --reporter=line` | 26 Chromium checks passed in 3.4 minutes. |

On the final binary, two fresh browser contexts opened the same actual local receipt `43db5f32-75e2-40e9-a302-46714014c469`. Both widths showed B at 14:30, revision 3 and zero free units alongside the unchanged ฿32 booking. Both sent zero POSTs. [1440 × 900](../screenshots/tour-f1-stock-desktop.png) · [390 × 844](../screenshots/tour-f1-stock-mobile.png)

The coordinator owns the post-merge production verification.
