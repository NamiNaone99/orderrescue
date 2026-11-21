# CASES. Five runnable business cases on the dispatch desk

21 Nov 2026, 15:40 ICT · Local Codex, Windows · gpt-6.2-astra

The presenter can select one of the five cases in section 5 of the supplied business brief. The chosen case shows the actual example message, what the presenter can demonstrate and which operational assumptions the prototype represents. Each case has a shareable URL and a second action based on the returned plan.

| Case | Dataset and observable action |
| --- | --- |
| Distribution during a flood | Synthetic hero picking outage. Inspect the alternate warehouses in each order's explanation. |
| Double-day campaign backlog | Historical UK one-day order queue and simulated stock. Analyse SKU 23084 and open the budget frontier. |
| Combined demand and supply shock | Historical queue and a synthetic two-SKU picking interruption. Select 23084, then run a separate plan for 23355. |
| Carrier capacity failure | Synthetic hero. Prepare B's later departure in chat, review the interpretation and confirm before replanning. |
| Critical SKU shortage | Synthetic hero. Inspect the competing orders and prepare C's stock-count report. Inventory changes only after confirmation. |

The campaign workload and flood are presenter hypotheses. Vehicle capacity, routing, staffing, margins and revenue are outside the model. Counts and costs on the case panel come from the current plan API response.

## Verification

| Command or walkthrough | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Installed the existing lockfile on Windows. |
| `pnpm lint`, `pnpm typecheck`, `pnpm build` | Passed. Next.js generated all 15 static entries. |
| `pnpm vitest run tests/client/demo-cases.test.ts` | Six passed. The existing offline interpreter and application validator accepted every fixture message. |
| `pnpm test` | 353 passed across 48 files. The 22 opt-in hosted Store cases were skipped. |
| `pnpm e2e --reporter=line` on the dedicated memory/offline production server | All 35 Chromium tests passed in 4.6 minutes, including the original eight-step tour, real-day SKU selection, phone booking and warehouse-chat replanning. |
| `pnpm e2e e2e/use-cases.spec.ts --reporter=line` against the production build | Passed in 11.6 s. Tested all five cases, both real-day SKUs and each follow-up action. Verified zero selection writes, zero axe findings on the selected desktop and phone panels, 44×44 minimum hit areas, the callout fitting the phone viewport, and the tour returning keyboard focus to the picker. |
| Local production-build Chromium walkthrough | On desktop the flood example served 1/2 first-come and 2/2 jointly at ฿88. On the phone the campaign example served 15/21 first-come and 16/21 jointly at ฿184. Both widths had zero horizontal overflow. |
| Additional operator confirmation on the isolated memory server | From the carrier case, confirming B's departure moved readiness from 13:30 to 14:30. The stale plan replanned from 2/2 at ฿88 to 1/2 at ฿32. From shortage, confirming C's count increased free units from 8 to 12. With B still delayed, replanning still served 1/2 at ฿32. |

The tour-to-case keyboard check initially caught a focus race while React was mounting the picker. The desk now restores focus after the tour has exited. Existing confirmations stay explicit and case selection makes no storage changes.

[Desktop, 1440×900](../screenshots/use-cases-desktop.png) · [Phone, 390×844](../screenshots/use-cases-phone.png)

Checks used local memory storage and offline interpretation. The coordinator owns production verification after merge.
