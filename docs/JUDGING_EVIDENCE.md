# OrderRescue judging brief

21 November 2026 · Sea × OpenAI Regional Codex Hackathon Thailand

OrderRescue helps a Thai dispatch operator recover several open orders after one warehouse disruption arrives in chat. The interpreter is designed to use a language model to extract the incident and ask for clarification when evidence is incomplete. The reviewed build uses the offline interpreter. The planner works from a confirmed incident and current stock. It compares feasible plans under one budget and gives the operator the final booking decision.

## What the judges can inspect

The on-site briefing specifies six criteria. Round one is a six-minute demo and pitch plus two minutes of Q&A with two judges. The top five advance to a six-minute final presentation plus four minutes of Q&A.

| Criterion | Evidence to show |
| --- | --- |
| Problem & Solution Fit | Put one Thai warehouse message on screen and explain the exact decision a multi-location dispatch operator has to make before pickup. |
| Build Quality | Run message → plan → stale stock → replan → confirm → receipt on the submitted build. Link the hero browser test and the CI run for the submitted commit when both are available. |
| Insight & Originality | Compare first-come, earliest-deadline-first with the cheapest feasible source, and joint planning. Show where the simpler rule ties and where it loses. |
| Real-World Value | Show incremental cost alongside orders allocated by deadline. Start field validation with one seller that controls stock and dispatch across at least two locations. |
| Alignment with Build Direction | AI-Native Products & Operations. A Thai chat alert starts a workflow that produces a validated plan and an operator-approved reservation. Identify the interpreter mode shown on stage. |
| Use of Codex | Show a review finding, the failing case, the fix, and the regression test or CI result. Attribute each human or agent decision using the team's actual record. |

## What the comparison proves

Both cases use synthetic orders and the same THB 100 budget across methods. “On time” means the allocated stock is projected to be ready by the order's deadline.

| Scenario | First-come, cheapest feasible | Earliest deadline, cheapest feasible | Joint |
| --- | --- | --- | --- |
| Hero. Two eight-unit orders. Only B is ready by the urgent deadline. | 1/2, THB 32 | 2/2, THB 88 | 2/2, THB 88 |
| Small urgent order. B has eight units at THB 4 each. C has four at THB 7 each. C is ready by the urgent deadline. The four-unit order arrives first and is due first. The later order needs eight units. | 1/2, THB 16 | 1/2, THB 16 | 2/2, THB 60 |

In the second case the joint plan assigns the four-unit order to C and keeps all eight units at B for the order that needs them. The first case shows why fast stock matters. The second shows why the quantities orders require can make deadline sorting insufficient. Both comparisons were replayed against the day-of planner. To reproduce the second case, clone the hero snapshot, set #101's arrival to 09:00 and quantity to four, and set C's on-hand stock to four and ready time to 13:45. Keep the incident, deadlines, other quantities and costs unchanged. Run the same greedy selection with its input sorted by deadline for the additional baseline. [Hero tests](../tests/planner/hero.test.ts) · [Greedy selector](../lib/planner/firstCome.ts) · [Business analysis](../BUSINESS_ANALYSIS_SUMMARY.md)

Measure the interpreter separately. Give the model and the operator the same Thai messages, including incomplete and unrelated cases, and send every confirmed incident through the same planner. Record exact warehouse, SKU and time-window matches, false incidents, clarification outcomes and time to a valid incident. Use the held-out cases and report the run size and the interpreter mode. [Interpreter test plan](TEST_PLAN.md#6-interpreter-evaluation-pnpm-eval)

## Why this is relevant to Sea

- Sea reported that instant and same-day delivery together accounted for nearly 15% of Shopee orders in Greater Bangkok in its Q3 2026 update. Our inference is that sellers who manage their own dispatch under short pickup windows are a useful group for field validation. The figure measures adoption of delivery services. Incident frequency, seller authority to move fulfillment between locations, and any integration still need field evidence. [Sea Q3 2026 earnings call, page 2](https://cdn.sea.com/investor/3Q2026/VZJl6wXWX76O8otphvf6/2026.11.10%20Sea%20Third%20Quarter%202026%20Earnings%20Call%20Transcript.pdf) · [Sea–OpenAI partnership](https://www.sea.com/news/406)
- A Samut Prakan study examined 623 delayed e-commerce shipments and identified multiple causes, including packing delays and full warehouses. For a pilot, collect both the number of dispatch incidents and the total number of orders. Log whether each incident could be addressed by switching stock locations. [Ophatwittayarak and Bunyasirirot](https://so10.tci-thaijo.org/index.php/msdru/article/view/199)
- Prior fulfillment research already accounts for the future cost of using inventory now. Shopify supports rule-based routing and Oracle supports guided order-exception recovery. Our hypothesis is that Thai incident intake, joint allocation and human-approved booking will improve the workflow for a small dispatch team. Compare against that team's existing WMS or OMS workflow in a pilot. [Acimovic and Graves](https://dspace.mit.edu/entities/publication/c330f547-294c-4a85-9110-946ceedbabc0) · [Shopify routing](https://help.shopify.com/en/manual/fulfillment/setup/order-routing/understanding-order-routing) · [Oracle exception assistant](https://docs.oracle.com/en/cloud/saas/readiness/scm/26c/order26c/26C-order-mgmt-wn-f49710.htm)

## Codex evidence already in the repository

- **Planner trade-off.** T03 used an ExecPlan and Codex review. The team documented a case that hit the search cap after finding nine on-time allocations. After the fix, the regression proves ten on-time allocations at THB 29. [T03 log](codex-log/T03.md) · [Planner regression](../tests/planner/solver.test.ts) · [PR #1](https://github.com/NamiNaone99/orderrescue/pull/1)
- **Booking invariant.** T04 review found that an unknown incident SKU could reach the memory store and change stock. The fix added scenario validation and a regression that checks the rejected request leaves the snapshot unchanged. The store contract also checks concurrent reservations and retries. [T04 log](codex-log/T04.md) · [Store contract](../tests/store/contract.ts) · [PR #2](https://github.com/NamiNaone99/orderrescue/pull/2)
- **Model-output boundary.** T05 recorded failing review cases, then verified that unsupported incident output leads to clarification. This evidence uses controlled interpreter responses. [T05 log](codex-log/T05.md) · [Interpreter tests](../tests/interpreter/injection.test.ts) · [PR #3](https://github.com/NamiNaone99/orderrescue/pull/3)

The existing harness is `AGENTS.md` → task acceptance criteria → ExecPlan → automated checks → review → logged result. If parallel Codex review is used, give one read-only reviewer the booking invariants and another the Thai interpreter cases at the same commit. Have the lead reconcile their evidence and record which changes were accepted. Add a subagent or surface to the demo only after its actual output and result are recorded. [Repository instructions](../AGENTS.md) · [ExecPlan template](../.agent/PLANS.md) · [OpenAI on harness engineering](https://openai.com/index/harness-engineering/)

## Release priorities

1. Finish the browser path first. At reviewed main commit `56e2ee7`, domain, planner, memory store, interpreter, CI and seven API routes were merged. The API task log records exact-line booking, replay and rejection of stale stock over HTTP. The home page was still the starter screen and Chromium smoke covered page load only. [Main CI run](https://github.com/NamiNaone99/orderrescue/actions/runs/44868045680) · [API PR](https://github.com/NamiNaone99/orderrescue/pull/6) · [API verification](codex-log/T06.md)
2. Before using live inventory, bind confirmation to a plan issued by the server and to an authorized operator. The current plan digest checks payload consistency. A production booking would need proof that the server issued the plan, plus current stock, eligibility and atomicity checks. The event demo uses synthetic inventory. [Planner digest](../lib/planner/hash.ts) · [Booking protocol](SPEC.md#8-staleness-and-booking-protocol)
3. Put evidence from the final submitted commit in the README or writeup. Record the deployed demo link, interpreter and storage mode, commands and outcomes, and prepared material or reused code according to the team's declarations. Keep public evidence to test results, relevant diffs and sanitized examples.

Local verification on the reviewed baseline passed `pnpm lint`, `pnpm typecheck` and `pnpm test` (207 tests). The final browser workflow, live interpreter accuracy and hosted storage still need their own evidence.

## Submission and pitch

The on-site briefing (slides 3, 7–10 and 17) sets development from **10:25 ICT**, freeze and submission at **17:00 ICT**, round one at **17:30–19:00 ICT** and finals at **19:30–20:30 ICT**. It requires on-site work in a new public repository. Teams can start from scratch or substantially extend an existing personal or open-source project, with links and the event-built scope in the README and submission form. Submit once per team with the repo, writeup, live demo or prototype link, and declarations. The writeup covers the problem, solution, build direction and use of Codex. The early Git history and the [README declarations](../README.md#declarations) record the scaffold and prepared planning documents. Confirm the treatment of those documents against the team's on-site instructions.

Suggested six minutes. **0:00–0:45** operator and disrupted dispatch. **0:45–3:45** live workflow with a stock slip and confirmed receipt. **3:45–4:40** trade-off, stronger baseline and real-world validation. **4:40–5:40** one Codex finding from review to regression to CI. **5:40–6:00** current demo mode and takeaway.
