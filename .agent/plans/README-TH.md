# Publish the project README in Thai and English

Maintain this plan under `.agent/PLANS.md`.

## Purpose

A Thai reader opening the repository can immediately try the dispatch demo or follow the full local and operating instructions. A reader who prefers English can reach the same material with one click.

## Progress

- [x] 2026-11-21 14:46 +07:00. Inventoried the root README, disclosures, historical evidence and incoming fragment links at `67350b7`.
- [x] 2026-11-21 14:50 +07:00. Translated 14 headings; validated 13 stable anchors, 40 local file references, four team-only fields and all four verbatim English declarations. Both live entry URLs returned 200. Lint, types, build and 298 local tests passed.
- [x] 2026-11-21 15:09 +07:00. Integrated INSIGHTS and CHAT at `7e5b1cc`. The READMEs link the two feature notes, distinguish the 22 local PostgreSQL contracts from T15’s 19 hosted contracts and retain the three-message evaluation. On this release, lint, types, build and 341 local tests passed; the 22 hosted checks were skipped.
- [ ] Reconcile the bilingual Operations section and accessibility evidence when T21 and T17b merge.

## Surprises & Discoveries

Two T22 documents point directly to `README.md#open-review-findings`. The root introduction has a placeholder live URL alongside a genuine deployed desk link.

## Decision Log

2026-11-21 14:46 +07:00, Codex. Use sibling Markdown files with reciprocal top links and preserve the old English heading identifiers on the Thai page. Distinguish the read-only guide from the interactive tour, which resets the shared hero. Keep team-authored evidence placeholders available.

## Outcomes & Retrospective

Pending the bilingual content and checks.

## Milestones and validation

From the repository root on Node 22 and pnpm 9, compare both READMEs to the existing English source, including commands, settings, human-only fields, data counts, third-party credits, limitations and disclosures. Validate the demo and presenter URLs by HTTP GET without running the tour. Check local links, fragment targets, identical command blocks, the English declarations against Git and UTF-8 Thai text. Run `pnpm lint`, `pnpm typecheck` and `pnpm test`. Review upstream T21 Operations, CHAT and INSIGHTS at integration; add shipped details only after merge. Write a compact task note and ledger entry. Re-run link and parity checks after conflict resolution.

## Retry and recovery

A reader can always switch languages from the first line after the title. Merge parallel documentation changes section-by-section, keeping updated release evidence in both versions. Keep uncertain human verification fields marked for the team.

## Revision history

2026-11-21 14:46 +07:00, Codex. Captured translation scope and acceptance checks.
