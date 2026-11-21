# OrderRescue Codex log

Application development started at 10:25 ICT on 21 Nov 2026. The team prepared the specifications before the event and committed them under `docs/` in `862a306`.

Times are ICT on 21 Nov 2026. Minutes are rounded elapsed time. Blank human-correction cells are for the team to fill in.

| Time | Task | Who | Surface (local/cloud/review) | Model | Prompt summary | Outcome (PR or commit) | Minutes | Tokens or credits (from /status) | Tests added | Human corrections | Chat id |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10:35 | T00 | P3 | local | gpt-6.2-astra | Scaffold Next.js and Windows tooling | `9376c67` | 10 | Unrecorded | 1 time-zone test | | `01a1fc29-d56b-7da2-8627-f3d104d6cf4c` |
| 10:47 | T01 | P3 | local | gpt-6.2-astra | Set up agent instructions, planning and the Codex log | `T01: add agent instructions, plan template and Codex log` | 3 | Unrecorded | 0 | | `01a1fc29-d56b-7da2-8627-f3d104d6cf4c` |
| 10:50 | T02 | Codex | local | gpt-6.2-astra | Define contracts, time helpers and the synthetic hero | `8c3bc37` on main | 4 | Unrecorded | 47 | | `01a1fc29-d56b-7da2-8627-f3d104d6cf4c` |
| 10:58 | T03 | Codex | local + review | gpt-6.2-astra | Compare first-come and joint allocations | [PR #1](https://github.com/NamiNaone99/orderrescue/pull/1), `882f72c` | 10 | Unrecorded | 26 | | `01a1fc29-d56b-7da2-8627-f3d104d6cf4c` |
| 11:10 | T04 | Codex | local + review | gpt-6.2-astra | Book confirmed stock atomically and replay once | [PR #2](https://github.com/NamiNaone99/orderrescue/pull/2), `bdfa711` | 7 | Unrecorded | 28 | | `01a1fc29-d56b-7da2-8627-f3d104d6cf4c` |
| 11:23 | T05 | Codex | local | gpt-6.2-astra | Validate interpreter answers and fall back offline | [PR #3](https://github.com/NamiNaone99/orderrescue/pull/3), `3c8ee19` | 7 | Unrecorded | 59 | | `01a1fc29-d56b-7da2-8627-f3d104d6cf4c` |
| 11:39 | T07 | Codex | local | gpt-6.2-astra | Add GitHub CI and a Chromium home smoke | [PR #5](https://github.com/NamiNaone99/orderrescue/pull/5) merged, lint, types, 161 tests and Chromium smoke passed locally, [PR CI passed](https://github.com/NamiNaone99/orderrescue/actions/runs/44867618648) | 5 | Unrecorded | 1 | | `01a1fc3a-3a11-7611-8652-7ff48477cf53` |
| 11:32 | T06 | Codex | local + review | GPT-6 | Expose seven dispatch API routes and verify confirmation, fallback and quotas | `T06: API routes with contract tests` on `t06-routes`, 207 tests and Chromium smoke passed locally | 16 | Unrecorded | 46 | | `01a1fc37-1a54-7440-8063-64309589a6f4` |

## Codex features used

| Feature | Used | Example PR |
| --- | --- | --- |
| AGENTS.md | [ ] | |
| ExecPlans | [ ] | |
| local CLI | [ ] | |
| cloud tasks | [ ] | |
| parallel worktrees | [ ] | |
| /review | [ ] | |
| GitHub review | [ ] | |
| codex exec in scripts | [ ] | |
