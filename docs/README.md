# OrderRescue event-day pack

Team AornSorn, table 23. Sea x OpenAI Regional Codex Hackathon Thailand, Sat 21 Nov 2026.
Hacking 10:00, working lunch 12:30, **code freeze and submission 17:00**, round one 17:15, finals 19:30.

This folder is a set of **specifications and plans, not code**. The judged build starts from an empty repository at 10:00 and is written during the event, mostly by OpenAI Codex. The rehearsal PoC in the parent repository is reference for ideas only. **Do not copy any PoC file, function or test into the judged repository.**

These documents were prepared before the event (with AI assistance). Say so if asked. They contain schemas, SQL signatures, API shapes and prompts, and no implementation.

## Files

| File | What it is | Who uses it |
|---|---|---|
| `HUMAN_CHECKLIST.md` | Everything only a person can do, in time order, with fallbacks | All three, from 08:30 |
| `AGENTS.md` | The instruction file for Codex. Goes into the new repo root (merged with the one `create-next-app` writes) | Codex, every session |
| `SPEC.md` | Product spec: flows, domain model, DB schema, API contracts, interpreter schema, planner rules, booking protocol, numbered acceptance criteria (AC-01..AC-31) | Codex reads per task; humans review against it |
| `DATA_PLAN.md` | Real dataset (UCI Online Retail II), mapping, seeded derivation, hero fixture, Thai eval set, provenance page text | P2 |
| `UI_SPEC.md` | Screens, states, Thai/English copy, tokens, a11y, polish checklist | P3 |
| `TEST_PLAN.md` | Unit, property, contract, eval, concurrency, e2e, a11y, CI, live smoke, pre-freeze checklist | All |
| `DEPLOY_PLAN.md` | Environments, env vars, migrations, reset, rate limit, rollback, fallbacks | P2 (Owner) |
| `CODEX_TASKS.md` | **The backlog.** 29 ordered tasks T00..T25 (T10 and T17 split a/b, plus T24b) with ready-to-paste prompts, schedule, cut-lines, stretch | All |
| `CODEX_MANUAL.md`, `codex-config.example.toml`, `codex-setup.ps1` | Codex how-to and laptop setup for the team (written separately; not reviewed with this pack). Laptop tooling only: do **not** copy these three into the judged repository | Each member, before 10:00 |
| `PITCH.md` | 90-second and 3-minute scripts, demo click-path, judge Q&A, limitations, submission kit | Presenter (P2) |

Roles: **P1** planner + booking. **P2** AI + API + data, and Owner (GitHub repo, Vercel, CI) and presenter unless agreed otherwise at 09:00. **P3** UI + Codex log.

## How to use this at 10:00

1. Before 10:00, work through `HUMAN_CHECKLIST.md` and ask the open questions below at check-in or the opening.
2. 10:00: the Owner creates the empty repo. P3 clones it, copies this folder in as `docs/` (with `AGENTS.md` renamed to `docs/AGENTS.team.md`, so task T01 can merge it into the generated root `AGENTS.md`) **before** starting Codex, and commits the folder on its own, before T00, as `docs: specifications and task prompts written before the event (no application code)`. Then P3 runs task **T00** from `CODEX_TASKS.md`. At check-in, show the organizers `SPEC.md` sections 4 and 6.2 specifically (SQL table definitions, JSON schema) and ask whether they count as code; if yes, delete those two blocks before committing and let Codex derive them from sections 3 and 6.3.
3. If the organizers do not allow bringing written specs, see the rules note; T00 then runs on an empty folder.
4. From then on, each person takes the next task for their role from `CODEX_TASKS.md`, pastes the prompt into Codex, reviews the result against the acceptance checks and opens a PR; P3 adds the row to `docs/CODEX_LOG.md` after the merge.
5. Checkpoints: first push 10:15, first production deploy by 10:45, hero path clickable on production 13:30, **MVP at 14:30**, Supabase hard stop 15:00, **feature freeze 15:45**, last merge to `main` 16:30 (no pushes after 16:30 except a rollback), submit by 16:50, freeze 17:00.

## Rules note

The acceptance email says only code written during the event is assessed, pre-built code is not accepted, and teams should come with ideas.

- These files are ideas and specifications. They hold no application code. Schemas, SQL signatures and JSON shapes are specification.
- **Ask at check-in:** "We wrote planning documents and task prompts beforehand. May we put them in the repository as docs?"
  - If yes: copy the folder in at 10:00 and commit it separately, as described above. The judged repo's README says the specifications were written before the event (task T23).
  - If only as reference: keep the folder open on a second screen and paste task prompts into Codex one at a time. Let Codex write `AGENTS.md` and `docs/SPEC.md` in the new repo from those prompts.
  - If no: do not copy or paste. Each member retypes or dictates the spec from memory to Codex (start with the hero scenario numbers and the acceptance criteria) and Codex writes the docs. Run task **T00N** first:

    ```
    Goal: write docs/SPEC.md and AGENTS.md from what I dictate.
    Context: I will paste or type the product description, the hero scenario numbers and the acceptance criteria.
    Constraints: specification only, no application code; number the criteria AC-01.. and keep section numbers 1-11 (users, flows, domain, schema, API, interpreter, planner, booking, errors, acceptance, non-goals).
    Done when: I confirm the hero numbers read back correctly.
    ```

    Then use the `CODEX_TASKS.md` prompts from the second screen (typed, not pasted, if pasting is not allowed). Where a prompt says "Read docs/..." for a document that does not exist, dictate that part.
- Scaffolding tools (`create-next-app`, `shadcn`) and npm packages are third-party dependencies, run during the event.
- The raw dataset is data, not code. Ask whether downloading it before 10:00 is allowed. If not, the download takes about one minute at 10:00.
- Be ready to state plainly: rehearsal PoC existed, was not reused; the specifications and prompts were written before the event with AI assistance (not Codex) and are committed separately; all application code in the judged repo was written from 10:00.

## Open questions for the opening (09:20)

Write the answers here on the day.

1. Submission format and channel (repo link, form, slides, video)? Exact deadline behaviour at 17:00?
2. Pitch length for round one and finals? Demo live or recorded? Language?
3. May pre-written specs and prompts be committed as docs? (see rules note)
4. May accounts (GitHub repo excluded), a Supabase project, a Vercel account and an OpenAI API key be created before 10:00?
5. May a public dataset be downloaded before 10:00? Is CC BY 4.0 open data acceptable?
6. How are the USD100 Codex credits delivered: on a ChatGPT account/workspace or as API billing? Does that include Codex cloud tasks and GitHub `@codex review`?
7. How are the USD100 API credits delivered: one key per person, or an organization we join?
8. Must the repository live in a specific GitHub organization, and must it be public or private? (Vercel Hobby cannot deploy an organization repo; see `DEPLOY_PLAN.md` fallback.)
9. Is a live URL expected or optional? Will judges open it on their own devices?
10. How do judges assess "effective use of Codex": transcripts, PR history, a written log, or a verbal account?
11. Are other AI tools allowed beside Codex? Any limit on third-party services (Vercel, Supabase)?
12. Venue network: is there a wired or dedicated Wi-Fi network, and are outbound ports other than 443 open?
