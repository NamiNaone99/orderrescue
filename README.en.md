# OrderRescue

[ภาษาไทย](README.md) · **English**

OrderRescue is a Thai-first dispatch desk for a wholesaler with several stock locations. An operator pastes a warehouse message, checks the interpreted picking interruption and compares first-come allocation with a joint plan under one extra-cost budget. After the operator confirms the exact rows, the server reserves the stock and returns a receipt. A stock change can make an unbooked plan stale.

[Open the live desk](https://orderrescue.vercel.app/) · [Start the guided demo with presenter notes](https://orderrescue.vercel.app/?tour=1&notes=1)

Team AornSorn started application development on 21 Nov 2026 at 10:25 ICT.

## Try the synthetic hero

Open the desk and select **วิธีใช้เดโม** for the read-only Thai walkthrough. Select the hero scenario and analyse **คลัง A งดหยิบ SKU-X รอบบ่ายวันนี้**. At 12:30, warehouse A reports that it cannot pick SKU-X from 13:00 to 18:00. Both orders need eight units. B has eight free at 13:30 for ฿4 per unit. C has eight free at 15:00 for ฿7 per unit. The budget is ฿100. [Open the live desk](https://orderrescue.vercel.app)

| Strategy | #101, due 14:00 | #102, arrived first, due 16:00 | On time | Extra cost |
| --- | --- | --- | --- | --- |
| First-come | Needs a person | B | 1/2 | ฿32 |
| Joint | B | C | 2/2 | ฿88 |

Try ฿87 to give the one affordable slot to #101, or ฿31 to see both orders go to a person. Restore ฿100 and use the demo event to move B's ready time to 14:30. The desk marks the old plan stale. Replanning serves #102 from B for ฿32. Confirm that row to get a receipt you can copy or download as a CSV. [Hero fixture](lib/scenarios/hero.ts)

**เริ่มสาธิต / Start demo** opens an eight-step interactive tour and resets the shared hero. The presenter-notes link adds a speaking line and timer. Each state-changing step uses the desk's real controls. Reviewing the booking and submitting it are separate actions. Reloading the public receipt link restores the booking and refreshes its stock panel. [Guided tour](docs/codex-log/TOUR.md) · [Receipt and stock refresh](docs/codex-log/TOUR-F1.md)

## How it works

1. **Interpret.** The server reads the message with the OpenAI Responses API or matches a scenario sample in offline mode.
2. **Validate.** Application code checks the warehouse, SKU, time window and verbatim evidence. The desk can ask for clarification or ignore an unrelated message. The operator can also enter an incident manually.
3. **Plan.** For one SKU, deterministic code compares first-come with a bounded joint search. Both respect open orders, existing commitments, deadlines and the shared budget.
4. **Confirm.** The operator reviews the assigned warehouse, quantity and unit cost for each served line. The dialog creates an idempotency key for that confirmation.
5. **Reserve.** The server verifies the submitted hash and budget. The Store checks order lines and grouped stock revisions, then commits the confirmed rows together. Affected orders left out of the booking stay open for a person. Retrying the same key and hash returns the original receipt.

See the [request flow, trust boundaries and booking sequence](docs/ARCHITECTURE.md).

## Run locally

Use Node 22 and pnpm 9.15.9. Run these commands from the repository root in PowerShell.

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Next.js, normally `http://localhost:3000`. The committed seed runs without credentials. Local verification returned HTTP 200 for the desk and reported healthy memory storage and offline interpretation at `/api/health`.

| Server setting | Default and purpose |
| --- | --- |
| `STORAGE_MODE` | `memory` keeps the demo in the server process. `supabase` uses the configured database. |
| `INTERPRETER_MODE` | `offline` handles the stored samples and asks for details on other messages. `openai` enables live parsing with a configured key. |
| `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_FALLBACK_MODEL` | The server-side key enables live calls. The default primary is `gpt-6-luna` and the second model is `gpt-6.2-sol`. |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | HTTPS project URL and server-side key for Supabase mode. |
| `DEMO_RESET_TOKEN` | Authorizes a real-day reset or reset of all scenarios. |
| `INTERPRET_DAILY_CAP`, `INTERPRET_BURST`, `INTERPRET_REFILL_MS` | Defaults are 500 live attempts per UTC day per server instance, a burst of 30 requests per IP, and one token every 2,000 ms. |

Optional settings belong in the gitignored `.env.local`. The browser calls the app's route handlers. See the [example environment](.env.example).

## Tests and checks

Local checks used Windows, Node 22.20.0, memory storage and offline interpretation. Browser checks use the Chromium build installed by `pnpm exec playwright install chromium` (completed successfully).

| Command | Observed result |
| --- | --- |
| `pnpm lint` | Passed. |
| `pnpm typecheck` | Passed. |
| `pnpm build`, then `pnpm start` | Production build passed and the local production server served the desk and API. |
| `pnpm test` | 291 passed after the T14 build, including planner properties, scale checks and the browser-asset scan. The 19 opt-in hosted database contracts were skipped. |
| `pnpm test:tz` | 48 domain checks passed in UTC and 48 passed in Asia/Bangkok. |
| `pnpm e2e` | All 23 local Chromium cases passed in 2.5 minutes on the T14 production build. |
| `pnpm smoke` | All 4 local smoke checks passed. |
| `pnpm audit --prod` | One moderate advisory in `minimatch@10.2.6`, pulled in by shadcn through ts-morph. Exit 1. [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) |
| `pnpm test:db` against hosted Supabase | The team verified 19/19 hosted contracts in 34.50 s in T15. For this revision, `run by the team: <to fill>`. [Hosted result](docs/codex-log/T15.md) |
| `pnpm eval --live --split heldout` with the human corpus | `run by the team: <to fill>` |

## Data and evaluation

| Label | What it covers |
| --- | --- |
| **Real** | Invoice IDs, SKU codes, product names, quantities and arrival times of day from a UK retailer on 22 Nov 2011. Source country and GBP unit prices are retained in the derived data. |
| **Simulated** | Warehouses, inventory, commitments, deadlines, ready times and transfer costs in THB. |
| **Synthetic** | The hero scenario and all Thai chat messages. |

The real-day build filtered 3,967 source rows to 2,802 rows and merged repeated invoice/SKU pairs into 2,674 lines on 129 orders covering 1,190 SKUs. It shifted dates to 21 Nov 2026, replaced customer IDs with linkable opaque references and treated the full day's order book as known at 12:30. The app's `/data` page shows field-level provenance. [Dataset transformations](data/ATTRIBUTION.md)

The committed offline run was a small smoke evaluation on 3 synthetic team-written messages. It scored 3/3 outcome kinds, 1/1 incident field sets (warehouse, SKU, window and evidence) and 1/1 clarification topics, with zero false incidents and zero skipped rows. All three answers came from the offline reader. Recorded interpreter latency was 0 ms at p50 and 1 ms at p95. These were the stored hero samples, with two development rows and one held-out row. Individual author and checker fields are blank. The strict human-authored corpus and 30-row held-out AC-26 verdict remain outstanding. [Evaluation report](evals/results/2026-11-21T05-06-52.511Z-offline-all.json)

## Operations

1. **Reset.** The desk's Reset action restores the selected seed and removes its reservations. Hero allows six resets per minute per IP. Real-day and all-scenario resets require the token.
2. **Smoke.** Run `pnpm smoke` locally. For a deployment, point `BASE_URL` at the chosen URL and allow the smoke to reset and book the shared hero. Deployment evidence is `run by the team: <to fill>`.
3. **Rollback.** In Vercel, use Instant Rollback to return traffic to the last deployment that passed smoke. Database schema corrections use a forward migration. [Deployment runbook](docs/DEPLOY_PLAN.md) · [Vercel rollback](https://vercel.com/docs/instant-rollback)
4. **Service fallback.** The live interpreter tries its second model after a failed attempt, then uses the offline reader. A depleted live quota also selects offline. A degraded database can serve memory reads and refuses writes.
5. **Demo fallback.** Use healthy production, then offline interpretation, then explicitly selected memory storage. On the fallback laptop, run `pnpm build` followed by `pnpm start` in memory/offline mode. A team-prepared recording is the final option when available.

Plans and reservations share a per-IP limit of 20 requests in a burst, refilling at one request per second on each server instance. JSON bodies above 16,384 bytes receive HTTP 413. Interpreter quotas and public hero resets have their own limits.

Submission URL for the team to confirm: `Live: <to fill>`.

## Limitations and scope

1. The wholesaler workflow is a hypothesis. Customer usage has yet to be observed.
2. The real-day benefit depends on simulated inventory, deadlines, readiness and costs.
3. UK retail invoices stand in for a Thai wholesaler's order book.
4. The three-message smoke covers the supplied samples. The validator checks for warehouse and time cues, including known shifts and written times. Spoken Thai aliases and times still rely on model interpretation, and unfamiliar phrasing can require clarification. Real warehouse language still needs independent evaluation.
5. Each plan handles one SKU, with a whole order line assigned to one warehouse.
6. Readiness is one timestamp per warehouse/SKU. Transport routing, vehicle capacity and travel times remain outside the model.
7. The search stops at 200,000 nodes and labels the best result found if the search is incomplete. The planning API rejects incidents affecting more than 60 orders. [Solver validation and timings](docs/SOLVER.md)
8. The demo has shared state, public hero reset and no login or operator roles. Memory-mode state lasts only for that server process.
9. Messages are pasted or selected from samples. There is no LINE or WhatsApp integration.
10. This was a one-day build. Security and load verification are limited to the recorded checks.

### Open review findings

The frozen implementation at `17a9dc5` had five P2 limitations. T14 closed F6 with a generated first-come comparison, a full-objective exhaustive oracle and a timed 40-order gate. Four P2 findings remain. [T22 findings and acceptance coverage](docs/codex-log/T22-review.md) · [T14 evidence](docs/codex-log/T14.md)

- Each model attempt has a nine-second deadline. The initial database read can push the full Interpret request beyond the 25-second target. Per-model logs omit the HTTP request ID, which makes it difficult to match attempts to simultaneous requests.
- A continuously focused desk can keep displaying the previous storage mode after an operational read falls back to memory. The store still refuses writes on the affected instance.
- The API accepts budgets above ฿2,147,483,647. PostgreSQL uses a signed 32-bit integer for booking budgets and rejects larger values.

### Not built

Per-visitor workspaces, general stock or order editing, multi-SKU joint planning, customer notifications and chat integrations are outside this implementation. Predefined demo events can change stock readiness. The [build evidence page](https://orderrescue.vercel.app/built-with-codex) links the task timeline, planner prompt, pull requests and tests.

### Accessibility evidence

Local axe scans found zero WCAG 2.0/2.1 A/AA violations on the planned desk and confirmation dialog at 1280×720 and 390×844. T20 also checked the demo guide, data page and not-found page at three widths, and reached the receipt by keyboard under reduced motion. The dedicated T17b audit is pending at this revision. [UI verification and screenshots](docs/codex-log/T20.md) · [Local scans](docs/codex-log/T23.md)

## How we used Codex

The team prepared specifications and task prompts before the event. During the build, Codex agents worked on scoped branches, wrote execution plans, exercised acceptance checks and recorded command results. Pull requests preserve the integration history. [Team ledger](docs/CODEX_LOG.md) · [Execution plans](.agent/plans/) · [Task evidence](docs/codex-log/) · [Pull requests](https://github.com/NamiNaone99/orderrescue/pulls?q=is%3Apr)

## Third-party data and software

- Chen, D. (2012). *Online Retail II* [Dataset]. UCI Machine Learning Repository. CC BY 4.0. The derived slice is filtered, date-shifted and augmented with simulated fields. [Dataset DOI](https://doi.org/10.24432/C5CG6D) · [CC BY 4.0 licence](https://creativecommons.org/licenses/by/4.0/)
- The app serves Sarabun locally for Thai and Latin in four weights. Copyright 2018 The Sarabun Project Authors. SIL Open Font License 1.1. [Bundled font licence](app/fonts/OFL.txt)
- The application uses Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, Zod and the OpenAI and Supabase SDKs. Third-party packages retain their licences. The project code uses the [MIT licence](LICENSE).

## Declarations

- Built on site at the Sea x OpenAI Regional Codex Hackathon Thailand on 21 Nov 2026. All application code in this repository was written from 10:25 that day, mostly with OpenAI Codex.
- The files in docs/ listed in the commit "docs: specifications and task prompts written before the event" are planning documents written before the event with AI assistance. They contain no application code.
- A rehearsal prototype of the same idea exists in a separate repository (https://github.com/poomphasindev/OrderRescue_OpenAI). No file, function or test from it was copied into this repository.
- Third-party scaffolders and packages (create-next-app, shadcn, npm dependencies) were run during the event.
