# Human checklist

Only people can do these. Tick as you go. "Owner" is the one teammate whose **personal** GitHub account holds the repo and whose Vercel Hobby account holds the project. Owner = P2 and Presenter = P2 unless agreed otherwise at 09:00; the presenter writes no code after 16:00.

Do not write application code before 10:00. If the organizers say accounts or downloads must wait until 10:00, move those items to the 10:00 block.

## Before 09:00 (home or on the way)

- [ ] Confirm the **Owner** (P2 by default). Personal GitHub account, not an organization. Fewer than two active Supabase free projects.
- [ ] Every laptop: charger, phone hotspot tested, mobile data available.
- [ ] Every laptop: `node -v` is 20.9 or later (22 preferred), `pnpm -v` works (`npm i -g pnpm` if not), `git --version`, `gh auth status` logged in.
- [ ] Every laptop: Codex installed. `npm install -g @openai/codex`, or on Windows `powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 | iex"`. Check `codex --version`.
- [ ] Owner laptop: `npm i -g vercel@latest` and `vercel --version` is 64.6 or later (the laptop that prepared this pack has 54.14.0, which is too old for `--environment`).
- [ ] Windows laptops: Windows 11 24H2 build 26100.9278 or later for the Codex MXC sandbox, or WSL2 installed as fallback.
- [ ] Each person has read `SPEC.md` sections 1, 2, 7, 8 and the acceptance criteria, and their own tasks in `CODEX_TASKS.md`.
- [ ] Presenter has read `PITCH.md` once aloud.
- [ ] Print or save offline: this checklist and the hero scenario numbers.

## 09:00-10:00 (at the venue)

Ask first (see README open questions), then do what is allowed.

- [ ] Check in, find table 23, join venue Wi-Fi, run a speed test. If slow, switch to hotspot now.
- [ ] Ask whether written specs may be committed, whether accounts and data downloads are allowed before 10:00, and how credits are delivered. Show the organizers `SPEC.md` sections 4 and 6.2 specifically (SQL table definitions, JSON schema) and ask whether they count as code (`README.md` rules note).
- [ ] **Credits.** Activate the Codex credits and the API credits exactly as the organizers describe. Write down which account holds them.
- [ ] **Codex sign-in.** If credits sit on a ChatGPT account: `codex login`. If they are API billing: `printenv OPENAI_API_KEY | codex login --with-api-key` (local only; Codex cloud and GitHub review need ChatGPT sign-in). Check `codex login status`.
- [ ] **Codex smoke test** in an empty scratch folder with `git init`: `codex exec --sandbox workspace-write "create hello.txt containing ok"`. If the sandbox fails on Windows, use WSL2.
- [ ] **OpenAI API project and key** (Owner or P2): create a project, create a key, set a monthly budget (for example USD 20). Keep the key in a password manager, never in chat.
- [ ] **Model ids.** Open the models page and confirm the ids in the research: `gpt-6-luna` (extractor), `gpt-6.2-sol` (fallback and Codex default), `gpt-6.2-astra` (hard tasks). These ids are unverified placeholders from pre-event research. If an id differs, correct it in `AGENTS.md`, `SPEC.md` sections 5 and 6, `DEPLOY_PLAN.md` section 2 and the T00 `.env.example` line before T11.
- [ ] **Vercel** (Owner): sign in with the Owner's GitHub account. Install the Vercel GitHub App with access to all repositories so the new repo is visible at 10:00.
- [ ] **Supabase** (Owner or P1): create a project in **Singapore**. Save the database password. Copy the project URL and the `sb_secret_...` key into the password manager.
- [ ] **Dataset** (P2, if allowed): `curl -L -o orii.zip https://www.kaggle.com/api/v1/datasets/download/mashlyn/online-retail-ii-uci` into a folder outside any repo. Expect about 15.2 MB. No Kaggle account needed.
- [ ] **Kaggle token** (optional, only if the curl route fails): kaggle.com > Settings > API > Create New Token; save `kaggle.json` to `%USERPROFILE%\.kaggle\`; `pip install kaggle`.
- [ ] Decide the generated `DEMO_RESET_TOKEN` (a random 24-character string) and store it in the password manager.
- [ ] Agree the working rules: one PR per task, nobody pushes to `main` directly after the first deploy (10:45) except P3's batched log-only commits, P3 keeps `docs/CODEX_LOG.md`, last merge 16:30.
- [ ] Attend the opening at 09:20. Write the answers into `README.md` open questions. Note the submission format and pitch length.

## 10:00 sharp

Owner = P2. P3 runs T00 on P3's own laptop after cloning the empty repo.

| # | Who | Step | Minutes |
|---|---|---|---|
| 1 | Owner | `gh repo create orderrescue --public --clone` (private if the rules say so). Add both teammates as collaborators with write access. Turn on secret scanning and push protection (Settings > Code security). | 2 |
| 2 | P3 | Clone the empty repo, copy the docs folder in and commit it on its own (`README.md`, "How to use this at 10:00"), then run task **T00** in Codex and push by **10:15**. If nothing is pushed by 10:15, use the fallback written under T00. | 15 |
| 3 | P1, P2 | Clone as soon as the first push lands. `pnpm install`. (Playwright Chromium is downloaded by T07 and, on each laptop, before its first e2e run: `pnpm exec playwright install chromium`.) | 3 |
| 4 | Owner | **Immediately after the first push:** Vercel: Add New > Project > import `orderrescue`. Set the function region to Singapore (`sin1`). | 3 |
| 5 | Owner | Add env vars for production and preview (table in `DEPLOY_PLAN.md`). Start with `STORAGE_MODE=memory`, `INTERPRETER_MODE=offline`. | 3 |
| 6 | Owner | Vercel > Settings > Deployment Protection: turn Vercel Authentication off (or create a Protection Bypass for Automation secret and add it as GitHub secret `VERCEL_AUTOMATION_BYPASS_SECRET`). Open the production URL in a private window and on a phone. Target **10:45**. | 2 |
| 7 | P2 | Copy `orii.zip` into `data/raw/` in the new repo (gitignored). | 1 |
| 8 | All | Create `.env.local` by hand from `.env.example`. Never commit it. | 2 |

## Later human steps (triggered by tasks)

- [ ] After the production URL works: connect the repo to Codex cloud and turn on automatic review (needs ChatGPT sign-in; one cloud environment with install script `pnpm install --frozen-lockfile` and package-manager network access; note the environment id). Time-box 10 minutes. If it is not working by then, use local worktrees and local `/review` for the day.
- [ ] Thai eval set: each member writes about 13 rows in `evals/messages.th.tsv` and a second member checks the labels (`DATA_PLAN.md` section 6). About 80 person-minutes in total, during Codex runs before 13:00; minimum 20 rows.
- [ ] 12:30 and 14:30: each member reads their Codex and API credit balance aloud. Under 30% left: default effort only, no cloud attempts.
- [ ] After T15 writes the SQL: paste the migration, then the seed, into the Supabase Dashboard SQL Editor (primary route, about 3 minutes). The CLI `supabase db push` is the fallback, not the default. Then `pnpm test:db`. **Hard stop 15:00**: not green by then means production stays on memory.
- [ ] After `pnpm test:db` is green: set `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `STORAGE_MODE=supabase` in Vercel, redeploy, check `/api/health`.
- [ ] After T11: set `OPENAI_API_KEY`, `OPENAI_MODEL`, `INTERPRETER_MODE=openai` in Vercel, redeploy, send the hero message once to warm the schema.
- [ ] After T11 is live: Vercel > Firewall > New Rule: Request Path equals `/api/interpret`, Rate Limit, fixed window 60 s, 120 requests, key IP, respond 429 (the venue shares one public IP). Publish. Optional; skip it if behind.
- [ ] 13:30 gate (hero path clickable on production), 14:30 MVP check, 15:45 feature freeze: decide cut-lines together (`CODEX_TASKS.md`).
- [ ] 16:00: record the backup video (`PITCH.md` click-path) from the production URL.
- [ ] 16:00: presenter (P2) opens the submission channel and fills the draft (T24b); first version submitted by 16:30 if resubmission is allowed.
- [ ] 16:30: last merge to `main`. No pushes after 16:30 except a rollback. Run the pre-freeze checklist in `TEST_PLAN.md`.
- [ ] By 16:50: submit the final version in the format announced at the opening. Take a screenshot of the submission confirmation.
- [ ] Before each judging rotation (not during one): reset the demo, run smoke in PowerShell: `$env:BASE_URL='<prod url>'; $env:DEMO_RESET_TOKEN='<token>'; pnpm smoke`. Keep one laptop on `pnpm build && pnpm start` in memory + offline mode; if production storage is memory, that laptop is the default for the demo.
- [ ] After finals: revoke the OpenAI keys and the Supabase secret key, rotate `DEMO_RESET_TOKEN`.

## Fallbacks

| Problem | Do this |
|---|---|
| Venue Wi-Fi slow or down | Phone hotspot. `pnpm dev` in the default modes (memory + offline) needs no network. |
| Codex credits not usable on ChatGPT sign-in | API-key login, local CLI only. Replace cloud tasks with separate git worktrees per person. Replace `@codex review` with local `/review` and paste the findings into the PR. |
| Codex sandbox broken on Windows | WSL2, or set `[windows] sandbox = "elevated"` (verify the key in the Codex docs). |
| Repo must be in an organization | Vercel Hobby cannot import it. Owner deploys from a laptop: `vercel link` then `vercel deploy --prod`. |
| Teammates' pushes do not deploy | Owner runs `vercel deploy --prod` from an up-to-date `main`. |
| Supabase provisioning or network fails, or `pnpm test:db` not green by 15:00 | Stay on `STORAGE_MODE=memory`. The UI shows a "memory" badge. Demo from the laptop (`DEPLOY_PLAN.md` section 9) and say so in the pitch. |
| OpenAI key, quota or latency problem | `INTERPRETER_MODE=offline`. The offline interpreter handles the sample messages and asks for clarification otherwise. |
| Kaggle endpoint fails | `curl -L -o orii_uci.zip "https://archive.ics.uci.edu/static/public/502/online+retail+ii.zip"` (xlsx inside; Codex adapts the script), or drop the real-day scenario (cut-line 8). |
| Vercel build queue or 100-deploy cap | Batch commits, merge PRs in groups, do not push work-in-progress branches. |
| Production broken near the freeze | Vercel dashboard > Deployments > last good one > Instant Rollback. |
| Live site unreachable during judging | Local laptop demo, then the recorded video. |
| T00 not pushed by 10:15 | A human runs T00 steps 1 to 4 by hand, pushes, and Codex does steps 5 to 8 as a follow-up commit. |
| Hero path not clickable on production by 13:30 | P1 pauses T15, P2 pauses T12, both join P3 until it is. |
