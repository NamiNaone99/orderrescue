# Dispatch planner

The planner compares whole-line assignments for open orders at the incident warehouse that contain the selected SKU. Each order can use one warehouse with enough uncommitted stock and an effective ready time on or before its deadline. The home warehouse costs zero. Other sources charge their per-unit transfer cost against the shared THB budget. Time comparisons use the scenario clock. [Planning rules](SPEC.md#7-planner)

## How the joint choice is made

The objective maximizes on-time orders. Among ties it prefers the lexicographically earliest sorted list of deadlines, then the lowest total cost, then the earliest sorted list of arrivals. If these are identical, it chooses the earliest sorted list of `(order ID, warehouse ID)` pairs.

First-come visits orders by arrival and chooses the cheapest feasible source. The joint search starts with the better of this allocation and a deadline-greedy allocation. It branches in deadline, arrival and ID order. For each order it tries individually feasible sources by cost and a skip choice. Remaining stock and budget are restored after each branch.

The search bounds the remaining count using individually feasible orders, the smallest quantities that fit each row and the cheapest costs that fit the budget. When count ties the incumbent it also checks an optimistic deadline, cost, arrival and assignment ranking. For compact stock ranges it remembers the best prefix at the same depth, remaining inventory and remaining budget. The default limit is 200,000 visited nodes. [Search](../lib/planner/joint.ts) · [Objective](../lib/planner/objective.ts)

- **Proven** means the search exhausted or bounded every potentially better branch.
- **Best found** means unexplored branches remained when the node budget ran out. The returned allocation respects capacities and budget and saves at least as many orders as first-come. A better plan may exist.

## Verification and local timings

The exhaustive test reference enumerates every combination of a warehouse or skip for each affected order, rejects infeasible assignments and ranks the remainder on all five levels. It imports domain types only. The regular seed checks 200 instances of 1–6 orders and 20 instances of 7–8 orders with 2–3 warehouses. The invariant, permutation, proven-budget and scale properties each run 200 times. Pure-solver stress inputs include a hypothetical fourth location; the public warehouse IDs remain A/B/C. [Oracle](../tests/helpers/bruteForce.ts) · [Properties](../tests/planner/properties.test.ts)

On 21 Nov 2026, Windows, Intel Core i9-13980HX, Node 22.20.0, Vitest 5.1.1. The timing brackets the entire synchronous `plan()` call. Each row includes five timed calls after one warm-up, excluding fixture loading, assertions, HTTP and storage. Generate the same fixtures and print current timings with `pnpm vitest run tests/planner/scale.test.ts --reporter=verbose`.

| Input | Affected | Nodes | Optimality | First-come / joint on time | Median ms | Max ms |
| --- | ---: | ---: | --- | ---: | ---: | ---: |
| Synthetic hero | 2 | 3 | proven | 1 / 2 | 0.12 | 0.21 |
| Generated synthetic | 8 | 6 | proven | 5 / 5 | 0.14 | 0.15 |
| Generated synthetic | 12 | 53 | proven | 7 / 9 | 0.36 | 0.79 |
| Generated synthetic | 25 | 2,122 | proven | 18 / 18 | 11.06 | 11.50 |
| Generated synthetic | 40 | 3,622 | proven | 24 / 28 | 19.22 | 19.96 |
| Real-day SKU 23084, ฿200 | 21 | 537 | proven | 15 / 16 | 1.71 | 1.83 |

The fixed 40-order benchmark is one instance. Of 200 generated scale instances at seed 20261121, nine reached the node cap, with 32–40 affected orders. They returned feasible labelled incumbents and every timed case was below the two-second gate. The real-day orders derive from UCI, while their warehouses, inventory, costs and deadlines are simulated. [Scale fixtures](../tests/planner/scale.test.ts) · [Task evidence](codex-log/T14.md)
