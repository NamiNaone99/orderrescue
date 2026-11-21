# UI specification

Thai is the primary language of the interface. English appears as secondary text on headings and key labels so non-Thai judges can follow. Product name stays "OrderRescue".

## 1. What judges must see in the first 10 seconds

On opening the production URL (hero scenario preloaded, nothing to configure):

1. The warehouse message, already in the input: `คลัง A งดหยิบ SKU-X รอบบ่ายวันนี้`.
2. One primary button: `วิเคราะห์ข้อความ` (Analyse).
3. After one click: two result cards side by side, `มาก่อนได้ก่อน 1/2` against `จัดร่วมกัน 2/2`, with THB 32 and THB 88, and the two orders moving to different warehouses.
4. A visible label: `ข้อมูลสมมติ (Synthetic scenario)` and badges showing which interpreter and which storage answered.

No landing page, no login, no modal on load.

## 2. Screens

| Route | Purpose |
|---|---|
| `/` | Dispatch desk: the whole flow on one screen |
| `/data` | Data provenance (`DATA_PLAN.md` section 7) |
| `/built-with-codex` | How the project was built with Codex |

Header on every page: logo text, nav (`โต๊ะจัดส่ง`, `ที่มาข้อมูล`, `สร้างด้วย Codex`), scenario switcher, scenario clock `เวลาจำลอง 12:30` (Scenario time) with the tooltip `เดโมนี้ใช้เวลาคงที่ของสถานการณ์ ไม่ใช่เวลาจริง`, interpreter badge, storage badge, Reset button.

- The selected scenario is the URL search parameter `?scenario=hero|real-day` (default `hero`); the switcher changes the URL and the desk reads it.
- Reset: in the hero scenario it resets at once, without a token; in other scenarios it opens a token dialog.
- `app/error.tsx`, `app/global-error.tsx` and `app/not-found.tsx` in the app style, each with Thai + English text and a `กลับไปโต๊ะจัดส่ง` link; error pages show the request id.
- `/data` and `/built-with-codex` are static server components that read repo files at build time. The desk is a client component.

## 3. Desk layout

Desktop (>= 1024 px), three zones in a 12-column grid, max width 1440 px:

```
[ Header ............................................................ ]
[ 1 Message + Incident (4 cols) ][ 2 Plan comparison (8 cols)         ]
[                               ][ first-come card | joint card       ]
[                               ][ order table with both assignments  ]
[ 3 Stock for the incident SKU (4 cols) ][ budget + Confirm bar (8)   ]
[ Reservations / receipts (12 cols, collapsed until first booking)    ]
```

Mobile (< 768 px): one column in the order message, incident, joint card, first-come card, order list as cards, stock, sticky bottom bar with budget summary and Confirm.

Step indicator above zone 1: `1 ข้อความ` > `2 เหตุการณ์` > `3 แผน` > `4 ยืนยัน`.

## 4. Components

| Component | Content and behaviour |
|---|---|
| `MessageInput` | Textarea (max 500, counter), sample chips for the scenario, Analyse button, `Ctrl+Enter` submits. Link `กรอกเหตุการณ์เอง` opens the manual form. Helper text under the textarea: `ข้อความจะถูกส่งไปยัง OpenAI เพื่ออ่านความหมาย อย่าใส่ข้อมูลส่วนบุคคล` / Text is sent to OpenAI for interpretation; do not paste personal data. Sample chips and the prefilled first sample come from `/api/state`. |
| `IncidentCard` | Warehouse, SKU (with name), window `13:00-18:00`, the message with the evidence quote highlighted (`<mark>`), validation ticks, interpreter badge with latency. When several SKUs: radio group to choose one; the choice survives re-analysis (AC-25). Split the message string around the quote and render React text nodes with `<mark>`; never `dangerouslySetInnerHTML` anywhere in the app (chat text, model output and dataset product names are always rendered as text). |
| `ClarificationCard` | The Thai question, which part is unclear, buttons `แก้ข้อความ` and `กรอกเอง`. No plan is shown. English secondary line from a template per `about` (for example "The message does not say which warehouse"), because model questions are Thai only. |
| `ManualIncidentForm` | Warehouse select, SKU combobox, start and end time inputs, inline validation. |
| `PlanCompare` | Two cards. Each: strategy name, large `on_time/total`, extra cost, short templated explanation. Joint card has the accent border and a delta chip (`+1 ออเดอร์ทันเวลา`, `+฿56`). Solver chip: `ดีที่สุด (พิสูจน์แล้ว)` or `ดีที่สุดที่พบ`. |
| `OrderTable` | Rows = affected orders sorted by deadline. Columns: order, arrived, deadline, qty, first-come source, joint source, ready time, extra cost, status. Changed assignments are emphasised. Late or unserved rows show `ต้องให้คนตัดสินใจ` with the reason. On mobile each row is a card. |
| `StockPanel` | Per warehouse for the SKU: on hand, committed, free, ready time, THB/unit, revision. The incident warehouse shows `งดหยิบ 13:00-18:00`. Rows used by the plan are marked. |
| `BudgetControl` | Number input with stepper, `งบเพิ่มได้ ฿100`, used/remaining bar. Changing it replans (debounced 300 ms). Preset chips `฿100`, `฿88`, `฿87`, `฿31` in the hero scenario for the demo. |
| `ConfirmDialog` | Title `ยืนยันการจองสต็อก`. Table of the exact rows to reserve, total cost, orders going to a human, and the sentence `ระบบจะจองตามรายการนี้เท่านั้น ถ้าสต็อกเปลี่ยน ระบบจะปฏิเสธ`. Buttons `ยืนยันจอง` and `ยกเลิก`. Focus is trapped; `Esc` cancels. |
| `Receipt` | Receipt id (short), time, rows, total, idempotency key (short), `replayed` note when applicable, copy button. |
| `StaleBanner` | Amber banner: `สต็อกหรือเวลาพร้อมของเปลี่ยนแล้ว แผนนี้ใช้ไม่ได้` with what changed (`คลัง B: พร้อม 13:30 → 14:30`) and `วางแผนใหม่`. |
| `DemoEvents` | Small panel `จำลองเหตุการณ์` with the scenario's predefined events. |
| `DataBadge` | `ข้อมูลสมมติ` (synthetic) or `ออเดอร์จริง + คลังจำลอง` (real orders + simulated warehouses), linking to `/data`. |
| `ModeBadges` | `AI: gpt-6-luna` / `AI: offline` (model id from `/api/health` `model`); `DB: Supabase` / `DB: memory` (red outline when `degraded`). |

## 5. States (all required)

| State | Where | Behaviour |
|---|---|---|
| Empty | Before analysis | Zone 2 shows a short illustration-free hint: `วางข้อความจากคลัง แล้วกดวิเคราะห์` and the three steps. Stock panel shows the scenario's default SKU. |
| Loading | Analyse, plan, confirm, initial state | Skeletons matching final layout (no layout shift); buttons show a spinner and are disabled; `aria-busy`. Interpreter loading text: `กำลังอ่านข้อความ...` |
| Clarification | After analyse | `ClarificationCard`; zone 2 stays in the empty state |
| Ignore | Message not about stock | `ข้อความนี้ไม่เกี่ยวกับการหยิบสินค้า` and nothing else changes |
| No affected orders | After plan | `ไม่มีออเดอร์ที่ได้รับผลกระทบ`. In the hero scenario this usually means someone already booked the demo: show the Reset button next to the message |
| Planned, full | Joint serves all | Green summary |
| Planned, partial | Some need a human | Summary names them; Confirm still allowed for the served rows; dialog lists the unserved orders |
| Planned, none | 0 on time (budget 31) | `งบไม่พอสำหรับแผนใดเลย` only when every reason is `OVER_BUDGET`, otherwise `ไม่มีออเดอร์ที่ช่วยได้ทันเวลา`; Confirm disabled |
| Best found | Solver hit its limit | Chip `ดีที่สุดที่พบ` with tooltip explaining the limit |
| Stale | Revision changed while the plan is unbooked | `StaleBanner`, plan dimmed, Confirm disabled, Replan focused. Never shown after a receipt: the booked state stops comparing revisions |
| Booking refused | 409/422 from reservations | Dialog closes, banner with the specific reason, nothing marked as booked |
| Booked | After receipt | Orders show `จองแล้ว`, stock panel updates, receipt shown, Confirm replaced by `เริ่มเหตุการณ์ใหม่` (hero: resets the scenario without a token and returns to the first view; other scenarios: clears the desk only) |
| Replay | Same key re-sent | Receipt with `ส่งซ้ำ ไม่จองเพิ่ม` |
| Interpreter fallback | Offline or second model answered, or `interpreter.rate_limited` is true | Badge changes; info line `ใช้ตัวอ่านสำรอง` |
| Storage fallback | DB down | Red-outline badge `DB: memory`; banner `ฐานข้อมูลไม่พร้อม การจองถูกปิดชั่วคราว` |
| Error | Network or 500 | Inline alert with Retry and the short request id; the last good data stays visible. Client fetches abort after 30 s (interpret) or 10 s (others) and show this state |
| Rate limited | HTTP 429 from plan, reservations, reset or the firewall | `มีการใช้งานมากเกินไป ลองใหม่ในอีกสักครู่`; manual form available |

## 6. Copy

| Key | Thai | English (secondary) |
|---|---|---|
| App tagline | `ผู้ช่วยจัดส่งเมื่อคลังมีปัญหา` | Dispatch help when a warehouse has a problem |
| Message label | `ข้อความจากคลัง` | Warehouse message |
| Analyse | `วิเคราะห์ข้อความ` | Analyse |
| Incident | `เหตุการณ์ที่อ่านได้` | Interpreted incident |
| Evidence | `ข้อความที่ใช้อ้างอิง` | Evidence |
| First-come | `มาก่อนได้ก่อน` | First-come |
| Joint | `จัดร่วมกัน` | Joint plan |
| On time | `ทันเวลา` | On time |
| Extra cost | `ค่าใช้จ่ายเพิ่ม` | Extra cost |
| Budget | `งบเพิ่มได้` | Extra budget |
| Needs human | `ต้องให้คนตัดสินใจ` | Needs a person |
| Free stock | `ว่างหลังหักที่จองแล้ว` | Free after commitments |
| Ready time | `พร้อมส่ง` | Ready |
| Deadline | `ต้องส่งก่อน` | Deadline |
| Confirm | `ยืนยันจอง` | Confirm booking |
| Replan | `วางแผนใหม่` | Replan |
| Booked | `จองแล้ว` | Booked |
| Reset | `รีเซ็ตเดโม` | Reset demo |
| Reason: no source | `ไม่มีคลังที่ส่งทันเวลา` | No on-time source |
| Reason: budget | `เกินงบ` | Over budget |
| Reason: stock | `สต็อกไม่พอ` | Not enough stock |
| Reason: not selected | `สต็อกหรืองบถูกใช้กับออเดอร์อื่น` | Stock or budget went to another order |
| Nothing can be saved | `ไม่มีออเดอร์ที่ช่วยได้ทันเวลา` | No order can be saved in time |
| Scenario time | `เวลาจำลอง` | Scenario time |
| Privacy note | `ข้อความจะถูกส่งไปยัง OpenAI เพื่ออ่านความหมาย อย่าใส่ข้อมูลส่วนบุคคล` | Text is sent to OpenAI for interpretation; do not paste personal data |
| New incident | `เริ่มเหตุการณ์ใหม่` | Start a new incident |
| Back to desk | `กลับไปโต๊ะจัดส่ง` | Back to the dispatch desk |

Rules: polite neutral Thai, no slang, no exclamation marks. Numbers as digits. Money `฿88`. Times `13:30` (24 h). Order ids `#101`. Explanations are templates filled from plan data, for example `#101 ต้องส่งก่อน 14:00 จึงใช้คลัง B (พร้อม 13:30)`. All strings live in one `lib/copy.ts` object with `th` and `en`. A native speaker on the team reads every string once before the freeze.

## 7. Design tokens

Defined as CSS variables in `app/globals.css` and mapped to the shadcn theme. Light theme only (a dark theme is a stretch).

| Token | Value | Use |
|---|---|---|
| `--background` | `#F8FAFC` | Page |
| `--card` | `#FFFFFF` | Cards |
| `--foreground` | `#0F172A` | Text |
| `--muted-foreground` | `#475569` | Secondary text |
| `--border` | `#E2E8F0` | Lines |
| `--primary` | `#0F766E` | Primary button, joint accent |
| `--primary-foreground` | `#FFFFFF` | |
| `--success` | `#15803D` on `#DCFCE7` | On time |
| `--warning` | `#B45309` on `#FEF3C7` | Stale, best-found |
| `--danger` | `#B91C1C` on `#FEE2E2` | Late, refused |
| `--info` | `#1D4ED8` on `#DBEAFE` | Notes, data labels |
| Radius | 12 px cards, 8 px controls | |
| Spacing | 4 px scale; card padding 20 px; grid gap 16 px | |
| Shadow | one soft level on cards, none on tables | |

Check every text/background pair for 4.5:1 contrast (3:1 for large text and icons). Status always has an icon and a word, not colour alone.

## 8. Typography

- Font: Noto Sans Thai via `next/font/google`, subsets `thai` and `latin`, `display: swap`, CSS variable `--font-sans`; `<html lang="th">`. If the venue network blocks the font download, commit the `.woff2` files and switch to `next/font/local`.
- Scale: hero numbers 48/52 semibold; page title 24/32; card title 18/28; body 16/26 (Thai needs generous line height); small 14/22. Nothing below 14 px.
- `font-variant-numeric: tabular-nums` on all quantities, times and money.
- English secondary labels: 14 px, muted colour, `lang="en"`.

## 9. Responsive, keyboard, accessibility

- Breakpoints: 390, 768, 1024, 1280. Test at 1280x720 (projector) and 390x844.
- No horizontal page scroll. Wide tables become cards on mobile.
- Tap targets at least 44x44 px.
- Tab order follows the flow: message, Analyse, incident, budget, Confirm. `Ctrl+Enter` analyses. `Esc` closes dialogs. Focus moves to the incident card after analysis and to the receipt after booking.
- Visible 2 px focus ring on every interactive element.
- Semantic landmarks (`header`, `main`, `nav`), one `h1` per page, real `table` markup with `th scope`, labels on every input.
- `aria-live="polite"` region announces: analysis result, plan summary (`จัดร่วมกัน ทันเวลา 2 จาก 2 ค่าใช้จ่ายเพิ่ม 88 บาท`), stale, booking result.
- Dialogs use the shadcn Dialog (focus trap, labelled title and description).
- `prefers-reduced-motion` disables transitions.
- Zero axe violations (wcag2a, wcag2aa, wcag21a, wcag21aa) on the desk in the planned state and on the confirm dialog. Violations not fixed inside the T17b time box are listed in the README, not hidden by disabling rules.

## 10. Motion

Only: 150 ms fade for card content swaps, a one-time highlight on rows whose assignment changed between first-come and joint, spinner on buttons. No decorative animation.

## 11. `/built-with-codex` page

Rendered from files in the repo so it stays true.

1. One paragraph: started from an empty repo at 10:00, what Codex did, what humans did (decisions, labels, review).
2. Timeline table from `docs/CODEX_LOG.md` (time, task, surface, model, outcome, human corrections).
3. Counts computed at build time where available: tasks run, PRs, Codex review findings fixed. If a number is not computed, leave it out rather than estimate.
4. Links: repository, PR list, `AGENTS.md`, `.agent/plans/`, `docs/codex-log/`.
5. "What Codex got wrong and how we caught it": two or three real entries from the log.
6. Architecture diagram (`docs/ARCHITECTURE.md` rendered or an SVG): message -> model (interpret only) -> validation -> planner -> confirm -> atomic reserve.

## 12. Polish checklist (T20)

- [ ] First paint shows the hero message and a working Analyse button; no flash of unstyled or English-only text.
- [ ] No layout shift between skeleton and content on any zone.
- [ ] Both plan cards have equal height; numbers align on tabular figures.
- [ ] Every button has hover, focus, active, disabled and loading styles.
- [ ] Long product names from the real dataset truncate with a tooltip and never break the table.
- [ ] Real-day scenario with 20+ affected orders stays readable: sticky table header, table scrolls inside its card.
- [ ] Empty, clarification, stale, refused and booked states each checked by eye at 1280 and 390.
- [ ] Thai text never clips (line height, no fixed heights on text containers).
- [ ] Favicon, page titles (`OrderRescue · โต๊ะจัดส่ง`), `lang`, meta description, Open Graph title.
- [ ] No console errors or warnings in production build.
- [ ] Data badge and mode badges visible without scrolling at 1280x720.
- [ ] Reset works from the header (no token in the hero scenario) and returns the desk to the first-10-seconds view.
- [ ] Error and not-found pages render in the app style.
- [ ] Footer: dataset attribution line and the sentence that the hero scenario and messages are synthetic.
- [ ] Screenshots of desk (planned), confirm dialog, stale, receipt, mobile saved to `docs/screenshots/` for the README and slides.
