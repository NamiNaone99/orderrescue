# DESK-UX — Give the dispatcher a clear decision

Maintain this plan according to `.agent/PLANS.md`.

## Purpose

Help a first-time dispatcher or judge go from a warehouse message to a decision. They should see what the desk understood, what it needs, which orders can still make the cutoff, and what using another warehouse costs.

## Progress

- [x] (2026-11-21 15:33 +07:00) Fetched main at `0a5afbb`, read the desk, planner-facing contracts and current browser checks, and created an ignored local environment file.
- [x] (2026-11-21 15:45 +07:00) Implemented the copy, clarification reply and decision summary. Updated the base to `a431bed`.
- [x] (2026-11-21 15:47 +07:00) Rechecked the browser with live OpenAI and captured desktop and mobile screenshots.
- [x] (2026-11-21 15:50 +07:00) Full browser suite passed 36 checks against the local production build. The branch is ready for review.
- [x] (2026-11-21 16:17 +07:00) Verified the plain-Thai demo copy, IBM Plex Sans Thai, and daisyUI after integrating the five cases. All 37 browser checks passed.
- [ ] Push PR #31, merge to main, and verify the existing Vercel deployment.

## Surprises & Discoveries

The plan already records the cost per unit for each warehouse and each order's cutoff. It has no penalty, lost-margin or actual delivery fields. The money shown in the hero is a simulated cost of using alternate stock.

The first layout attempt squeezed the plan because its children inherited placements intended for the outer dashboard grid. The plan column now uses a flex stack. The browser check verifies minimum usable panel widths at desktop and phone sizes.

## Decision Log

- 2026-11-21, Codex. Use the existing interpreter and planner for a guided workflow. Send a follow-up together with the original text through the same validation path. Keep the 500-character limit.
- 2026-11-21, Codex. Explain the two plans in terms of pickups and extra warehouse costs. Allow a local estimate of avoided loss using a value entered by the operator. Keep this estimate independent of planning and booking.

## Outcomes & Retrospective

Live OpenAI asked for the missing window and accepted the operator's inline reply. The desk showed an additional on-time order for ฿56, and the browser confirmed that the plan used the full available width at 1280px and 390px. The [task log](../../docs/codex-log/DESK-UX.md) holds the replay and screenshots.

## Starting point

`app/page.tsx` lays out the desk. `components/desk/message.tsx` renders input and interpreted facts. `components/desk/plan.tsx` compares plans. `lib/client/use-desk.ts` coordinates interpretation, planning and booking. `lib/copy.ts` holds Thai and English labels. Existing tests use Playwright and Vitest.

## Milestones and steps

1. Label warehouse, product and picking window in plain Thai. Keep extracted values and their source visible. Give the operator an inline reply when details are missing, alongside manual entry.
2. Show affected count, extra on-time orders, cost difference and per-order arithmetic together. Put the budget and booking action directly under the plans. Keep the detailed breakdown and the guided demo reachable.
3. Run the commands below from the repository root with Node 22 and pnpm.

       pnpm lint
       pnpm typecheck
       pnpm test
       pnpm e2e --reporter=line

## Validation and acceptance

Open the hero. Confirm first-come shows one of two for ฿32 and the other plan shows two of two for ฿88, with ฿56 as the difference. Check that the cost estimate uses the number entered by the operator and stays outside the booking request. Submit an incomplete message and verify that the desk asks a specific question without planning. A complete reply is interpreted together with the original. Check the mobile and desktop layouts, replan after a confirmed delay, and verify the receipt.

## Retry and recovery

Run QA with memory storage and offline interpretation for deterministic browser checks. Start a fresh local process or reset the local hero when any reservation remains. Live credentials belong in the ignored environment file. The change has no database migrations.

## Revision history

2026-11-21, Codex. Initial plan based on the user's feedback about language, money and workflow.

2026-11-21 15:49 ICT, Codex. Recorded the live journey and the mobile layout regression check.

2026-11-21 15:50 ICT, Codex. Recorded successful local browser acceptance.

2026-11-21 16:07 ICT, Codex. Integrated the demo cases and added the final release pass. Keep the demo copy in the web layer so the existing hosted seed and evaluation data remain usable.
