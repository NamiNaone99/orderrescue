# TOUR — Guide a presenter through a real hero booking

## Purpose

A dispatcher or presenter can start an eight-step Thai/English walkthrough from the header or the tour URL, read what changed at each step, operate the real controls, and recover the saved receipt after reload.

## Progress

- [x] (21 Nov 2026 13:40 ICT) Read the agent rules, UI_SPEC, PITCH click-path and installed Next.js client/navigation guides. Integrated the T22 corrections at `fd30ff3`.
- [x] (21 Nov 2026 13:40 ICT) Received the coordinator's official production Playwright baseline on `5b6b055`: 1/2 at ฿32, 2/2 at ฿88; warehouse B moved 13:30 to 14:30, replanning selected #102/B ×8 at ฿32; HTTP 201 receipt `e08cbb4c-f026-41b1-9335-e2fe32f29b60` and a working CSV. Hero was restored.
- [x] (21 Nov 2026 13:50 ICT) Wire explicit tour ignition, state-based progression, recovery and persisted receipt lookup.
- [x] (21 Nov 2026 13:53 ICT) Build a keyboard-accessible projector/phone spotlight and optional pitch notes.
- [x] (21 Nov 2026 14:04 ICT) Verify all repository gates, inspect all eight steps at both sizes, update the task log and ledger.

## Decisions and discoveries

This is a presentation-layer feature. The desk already owns the real reset, interpretation, simulated event, replan, confirmation and booking actions. The tour will reference those controls and derive figures from the same plan and inventory. Reviewing and submitting a booking remain two separate actions. An ID in the URL can identify the actual receipt returned by the state API after reload.

## Starting point and milestones

1. Connect the existing scenario shell, desk actions and receipt panel to deliberate hero-only tour starts. Implement a small tested state machine. Preserve the read-only guide.
2. Add a spotlight and adjacent callout, bottom-docked on a phone. Support the actual highlighted control, arrow/Enter/Escape/period navigation, live announcements, reduced motion, optional speaking notes and elapsed time.
3. Exercise the real hero on a local memory/offline production build at port 3230. Test state transitions, dynamic data, retries, reload, modal focus and a single booking. Capture eight paired screenshots. Run lint, typecheck, unit, production build and all Chromium tests.

## Retry and recovery

Surface storage, network and unexpected-state failures in the coachmark. Preserve the same pending confirmation for ambiguous responses. A restart runs the existing hero reset only by explicit operator action. Exit preserves the current desk state.

## Outcomes and revision history

21 Nov 2026. Initial plan after the production baseline. The coordinator owns PR integration and post-merge production verification.

21 Nov 2026 14:00 ICT. Rebased onto `5f009f9` with T22 and T14. At 1440px the restored booking spans eight grid columns (883px). At 390px both order deadlines are visible and the remaining order fields scroll inside the spotlight. The final budget check exercised the desk itself at ฿31 and ฿100. The ledger and task log include the production baseline, both viewport captures and recovery results.

21 Nov 2026 14:04 ICT. Lint, TypeScript, 294 unit tests, production build and all 24 Chromium checks passed. The 19 opt-in database checks remained skipped. The task log lists both capture runs, eight accessibility scans and the receipt recovery probe.
