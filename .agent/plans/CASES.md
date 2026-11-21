# CASES — Select and run five business use cases on the dispatch desk

## Purpose
A presenter can choose any case from section 5 of the supplied product brief, read its operational limits, and run the existing desk against its actual scenario. The original eight-step hero tour stays available.

## Progress
- [x] 2026-11-21 15:40 ICT. Read both briefs, AGENTS, UI_SPEC, PITCH and the current scenario, interpreter, desk and tour interfaces. Identified the two published real-day messages and three synthetic warehouse updates.
- [x] 2026-11-21 15:45 ICT. Implemented five shareable routes, grounded samples, live metrics and distinct next actions. The picker appears on the desk and is reachable from step one of the existing tour.
- [x] 2026-11-21 15:50 ICT. Passed all six fixture checks and the five-case Chromium walkthrough. Verified 44×44 minimum targets, the phone tour callout, keyboard return, and zero axe findings on the selected desktop and phone panels.
- [x] 2026-11-21 15:54 ICT. Lint, typecheck and production build passed. The full suite passed 353 unit tests and 35 Chromium tests. Captured the desktop and phone demonstrations and recorded local evidence in the task log.

## Decisions and discoveries
The real-order day supplies historical UK demand and simulated operations. Campaign and disaster are presenter contexts. The two-SKU real-day sample supports a second simultaneous constraint and a real one-SKU-at-a-time comparison. Use the existing bounded departure and stock-found reports for the other follow-ups. The brief's economic example gives hypothetical margin, labor and sales figures. The desk displays measured counts and extra THB only.

## Implementation and validation
Add a shareable case selection above the existing workflow. Selection may load another registered scenario but never applies an event, resets stock or reserves an order. Run interpretation after an explicit operator action. Preserve the normal booking and tour paths. Check five routes with Vitest and Playwright, capture desktop and phone screenshots, and run pnpm lint, typecheck, test, build and e2e on a local memory/offline production server.

## Recovery and outcome
The user can leave a case or use the existing tour entry at any time. Use a fresh local memory process to repeat verification without affecting shared state.

The focused browser check caught a tour focus handoff before the picker mounted. Moving focus from the desk after leaving the tour made the first-step case chooser keyboard-operable. The desktop flood and phone campaign screenshots show the actual plan results.

## Revision history
21 November 2026, 15:40 ICT. Created before implementation.
