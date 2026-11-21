# Pitch

Pitch length and format are announced at the opening. Two scripts are ready: 90 seconds and 3 minutes. If the slot is 60 s: steps 1-3 and 6-8 of the click-path only. If 5 min: the 3-minute script plus `/data` and `/built-with-codex`. Round one may be in Thai; finals in English. There is no Thai 3-minute script; if round one gives 3 minutes in Thai, the presenter extends the Thai 90-second draft with the interpret and real-data paragraphs of section 4. Presenter = P2 unless agreed otherwise at 09:00. The Thai text below is a draft; the presenter rewrites it in their own words and reads it aloud twice before 17:00.

Every number spoken must be one the build actually produced. Replace each `[fill]` with the real value from `docs/CODEX_LOG.md`, the eval result file or CI before presenting. If a feature was cut, remove its sentence. If production storage is memory (Supabase cut), do not say "database" or "transaction": say the booking is one all-or-nothing step, tested in memory only.

## 1. One-line description

OrderRescue reads a warehouse's chat message, works out which orders are in trouble, and books a plan that gets more of them out on time than first-come-first-served does.

## 1a. Framing facts (fill before 16:00, say only what is true)

1. Who: `[fill: one sentence about a real wholesaler or seller a team member knows, with permission, or "hypothesis, not validated"]`.
2. Size of the effect in our data: on the real-order day, first-come ships [fill]/[fill] affected orders on time and the joint plan [fill]/[fill] (simulated stock; illustrative).
3. Why here: multi-warehouse sellers on marketplaces such as Shopee coordinate stock problems in chat.

## 2. 90-second script (English)

**Problem (15 s).** A small wholesaler keeps stock in three places. At noon a warehouse sends one chat message: "Warehouse A can't pick this item this afternoon." Two orders need that item. The dispatcher fixes them one at a time, in the order they arrived.

**Demo (50 s).** [Click Analyse] The model turns the Thai message into a structured incident: warehouse A, this SKU, 13:00 to 18:00, with the exact words it relied on highlighted. If it is not sure, it asks a question instead of guessing.

From here there is no AI. Our code finds the two affected orders. First-come gives the fast warehouse to the order that arrived first, which was not urgent, so one of two ships on time. Planned together, the urgent order takes the fast warehouse and the other takes the slower one: two of two, for 88 baht, inside a 100 baht budget.

[Click the slip event] Warehouse B now says its stock is ready an hour late. The plan on screen is marked stale and cannot be booked. [Replan, Confirm] We replan, confirm, and the stock is reserved in one atomic transaction. Sending the same confirmation twice books once.

**Why it holds up (15 s).** The model only interprets. Validation, planning and booking are deterministic code with [fill] tests, including a check of the solver against brute force. It is live at [url], with one real day of orders from a public UK online-retail dataset whose customers include many wholesalers loaded next to this example.

**Codex (10 s).** The repository was empty at 10:00. Codex wrote the code from [fill] task prompts. After the first deploy, changes went through pull requests ([fill] of [fill] with a Codex review), and the log of what it got wrong is in the repo.

## 3. 90-second script (Thai draft)

**ปัญหา.** ร้านขายส่งขนาดเล็กมีสต็อกอยู่สามคลัง ตอนเที่ยงคลังส่งข้อความมาว่า "คลัง A งดหยิบสินค้าตัวนี้รอบบ่าย" มีสองออเดอร์ที่ต้องใช้สินค้านี้ คนจัดส่งมักแก้ทีละออเดอร์ตามลำดับที่เข้ามา

**เดโม.** [กดวิเคราะห์] โมเดลอ่านข้อความภาษาไทยแล้วแปลงเป็นเหตุการณ์ที่มีโครงสร้าง คลัง A สินค้านี้ 13:00 ถึง 18:00 และไฮไลต์คำที่ใช้อ้างอิง ถ้าไม่ชัดเจน ระบบจะถามกลับ ไม่เดา

หลังจากนี้ไม่มี AI แล้ว โค้ดของเราหาออเดอร์ที่ได้รับผลกระทบ ถ้าจัดแบบมาก่อนได้ก่อน ออเดอร์ที่มาก่อนแต่ไม่ด่วนจะได้คลังที่เร็ว ส่งทันแค่หนึ่งในสอง ถ้าจัดร่วมกัน ออเดอร์ด่วนได้คลังเร็ว อีกออเดอร์ใช้คลังที่ช้ากว่า ส่งทันทั้งสอง ใช้เงินเพิ่ม 88 บาท จากงบ 100 บาท

[กดเหตุการณ์จำลอง] คลัง B แจ้งว่าของพร้อมช้าไปหนึ่งชั่วโมง แผนเดิมถูกแจ้งว่าใช้ไม่ได้และจองไม่ได้ [วางแผนใหม่ แล้วยืนยัน] ระบบจองสต็อกในธุรกรรมเดียว ส่งคำยืนยันซ้ำก็จองแค่ครั้งเดียว

**ความน่าเชื่อถือ.** โมเดลทำหน้าที่อ่านอย่างเดียว การตรวจสอบ การวางแผน และการจองเป็นโค้ดที่ให้ผลเหมือนเดิมทุกครั้ง มีเทสต์ [fill] รายการ ใช้งานจริงได้ที่ [url] และมีออเดอร์จริงหนึ่งวันจากชุดข้อมูลค้าปลีกออนไลน์ของสหราชอาณาจักร (ลูกค้าจำนวนมากเป็นผู้ค้าส่ง) ให้ลอง

**Codex.** เริ่มจาก repo ว่างตอน 10:00 Codex เขียนโค้ดจากคำสั่งงาน [fill] งาน หลัง deploy ครั้งแรก การแก้ไขผ่าน pull request ([fill] จาก [fill] รายการมี Codex review) พร้อมบันทึกว่า Codex ผิดตรงไหนและเราจับได้อย่างไร

## 4. 3-minute script (English, finals)

**0:00 Problem (30 s).** Small Thai wholesalers run on chat. Stock sits in two or three locations, and news about it arrives as messages like this one: "Warehouse A, no picking of this item this afternoon." The dispatcher has to work out which orders are hit and where else the goods can come from, while new messages keep arriving. The usual method is first come, first served. It is fair, and it wastes the fast stock on orders that could have waited.

**0:30 Interpret (35 s).** [Analyse] We use an OpenAI model for one job: turn the message into a strict structure. Warehouse, SKU, time window, and the quote it relied on. The output must match a JSON schema, and then our code checks it: the warehouse exists, the SKU exists, the times make sense, the quote really is in the message. [Click the ambiguous sample] If anything is missing, the operator gets a question, not a plan. On [fill] held-out test messages that we wrote, it produced [fill] false incidents. Those messages are synthetic and it is a small smoke test, not a benchmark.

**1:05 Plan (45 s).** From here it is deterministic code. Two orders are affected. Order 102 arrived first and is due at 16:00. Order 101 is due at 14:00. Warehouse B can have 8 units ready at 13:30; warehouse C at 15:00, at a higher cost. First-come gives B to 102, and 101 misses: one of two. The joint plan gives B to 101 and C to 102: two of two for 88 baht. [Budget 87] One baht less and it can only save one, and it picks the more urgent order. The solver is exact on small cases and bounded on large ones; it tells you which, and it is tested against brute force.

**1:50 Stale and book (35 s).** [Slip event] Stock changes while people decide. B now says 14:30. The plan is marked stale and the Confirm button is disabled. If two operators confirm at once, the database refuses the second. [Replan, Confirm] Booking reserves exactly the rows on screen in one transaction, or nothing. The same confirmation sent twice books once.

**2:25 Real data and limits (20 s).** [Switch scenario] This is one real day of orders from a public UK online-retail dataset whose customers include many wholesalers, [fill] orders. The orders are real; the warehouses and stock are simulated, and the screen says so. On this day the joint plan saves [fill] orders against [fill] for first-come.

**2:45 Codex (15 s).** We started from an empty repository at 10:00. The specifications and task prompts were drafted before today; today Codex wrote all the code from them, ran the tests and reviewed [fill] of [fill] pull requests. [fill] tasks. The log, including the mistakes we caught, is on the "built with Codex" page.

## 5. Demo click-path (60 to 90 seconds)

Before starting: reset the demo, hero scenario selected, browser at 1280x720, zoom 100%, one tab.

| # | Action | Say | Expect on screen |
|---|---|---|---|
| 1 | Point at the message | "This is what the warehouse sent." | `คลัง A งดหยิบ SKU-X รอบบ่ายวันนี้` |
| 2 | Click `วิเคราะห์ข้อความ` | "The model only reads it." | Incident A / SKU-X / 13:00-18:00, evidence highlighted, AI badge |
| 3 | Point at the two cards | "First-come: one of two. Planned together: two of two." | 1/2 ฿32 and 2/2 ฿88 |
| 4 | Point at the order table | "The urgent order takes the fast warehouse." | #101 from B, #102 from C |
| 5 | Click budget chip `฿87` then `฿100` | "One baht short, it saves the urgent one." | 1/2 with #101, then back to 2/2 |
| 6 | Click event `คลัง B แจ้งของพร้อมช้าเป็น 14:30` | "Stock changed while we were deciding." | Stale banner, Confirm disabled |
| 7 | Click `วางแผนใหม่` | "Now only one can be saved; the other goes to a person." | 1/2, #102 via B, #101 needs a person |
| 8 | Click `ยืนยันจอง`, then confirm in the dialog | "It books exactly these rows or refuses." | Receipt, stock updated |
| 9 | (3-minute version) switch to the real-day scenario, analyse the sample | "Real orders, simulated warehouses." | Larger table, data badge |
| 10 | (if asked) open `/data` or `/built-with-codex` | | Provenance table or Codex log |

Recovery lines: model slow -> "It falls back to a second model, then to an offline reader; the badge shows which answered." Site down -> switch to the local laptop without comment, then explain.

## 6. Judge Q&A

### Problem framing

- **Who has this problem?** Small wholesalers with stock in more than one place who coordinate by chat. We have not interviewed customers at this event; the scenario comes from the team's own understanding and is a hypothesis to test.
- **Why not just use an ERP?** Those assume structured input. The news arrives as chat, and the decision is made before anyone updates a system.
- **Why is first-come the right baseline?** It is what a person does when handling orders one at a time, and it is easy to explain to customers. We show it next to the joint plan so the operator sees what the change costs and gains.
- **Is fairness lost?** Arrival order is still a tie-breaker, after on-time count, urgency and cost. Orders that lose go to a person, not silently late.

### Build quality

- **What is tested?** Planner unit tests on the hero numbers and budget boundaries, property tests against a brute-force oracle, store contract tests including a concurrency race, route contract tests, Playwright on local and the live URL, axe checks. Counts: [fill from CI].
- **What happens if two people confirm at once?** One Postgres function locks the stock rows, checks each row's revision and free quantity and each line against a real open order, and commits or rolls back everything. We ran the race test against the hosted database: [fill result, or "against the in-memory store only"].
- **What if OpenAI is down?** Timeout of 9 seconds, a second model, then an offline interpreter that recognises only the sample messages and otherwise asks the operator to fill the form. Planning and booking never depend on the model.
- **Security?** Keys are server-side only; the browser calls our routes; database tables have row-level security with no public policies; model calls are rate-limited and capped per day; chat text is treated as data, rendered as text only, sent to OpenAI with storage off and never logged.

### Depth of thinking

- **Why not let the model plan?** Planning has hard constraints: stock, deadlines, budget. Code can guarantee them and a test can prove it. A model's answer could not be checked the same way, and it could change between runs.
- **How do you stop hallucinated incidents?** Strict schema, then validation in code: known warehouse and SKU, valid times, and the evidence quote must be an exact substring of the message. Our safety metric is false incidents; target zero.
- **Does the solver scale?** Exhaustive search grows as (warehouses + 1) to the power of orders. We use branch and bound with a node limit, seeded with the first-come and a greedy plan, so it is never worse than first-come and it reports whether the result is proven optimal. Measured: [fill n and time].
- **Is the data real?** Order ids, products, quantities and order times are from UCI Online Retail II (CC BY 4.0), a UK online retailer with many wholesale customers; it is not a wholesale dataset and not Thai. Warehouses, stock, deadlines and costs are simulated with a fixed seed. The hero example and all chat messages are written by us. The app labels each.
- **What does the stale check cover?** Any change to quantity, commitments, ready time or cost of a stock row the plan uses bumps a revision; booking compares revisions inside the transaction.

### Effective use of Codex

- **What did Codex do?** Scaffolding, planner, store and SQL, routes, UI, tests, CI, the dataset script, and reviews of [fill] of [fill] PRs. [fill counts]
- **What did people do?** Chose the problem and the rules, reviewed every diff, labelled the evaluation messages, made the cut decisions. The specifications, acceptance criteria and task prompts were drafted before today with help from an AI assistant other than Codex; today Codex wrote all the code from them.
- **How did you direct it?** A short `AGENTS.md` with the boundaries, one task per chat with Goal, Context, Constraints and Done-when, the hero numbers as the acceptance test, ExecPlans for the multi-step tasks, parallel tasks on separate branches.
- **Where did it go wrong?** [fill two real examples from `docs/CODEX_LOG.md`, with how it was caught: a failing property test, a review finding, a human reading the diff.]
- **Was anything prepared before today?** Yes: the idea, written specifications and task prompts, and a rehearsal prototype that we did not reuse. All code in this repository was written today, as the commit history shows. The documents in docs/ were written before 10:00 with AI assistance and are committed separately so the history shows it.

## 7. Honest limitations (say these if asked; put them in the README)

1. No real customer has used it. The problem framing is a hypothesis.
2. Warehouses, stock, deadlines, ready times and costs are simulated, so the size of the benefit on the real-order day is illustrative.
3. The dataset is from a UK retailer, used as a stand-in for a Thai wholesaler.
4. The Thai message evaluation is [fill n] team-written messages. It shows the pipeline behaves safely on those, not real-world accuracy.
5. One SKU is planned at a time, and an order line is never split across warehouses.
6. Ready time is a single number per warehouse and SKU; transport and vehicle capacity are not modelled.
7. For large incidents the solver may return the best plan found within its limit, not a proven optimum; the screen says which.
8. No login or roles; the live demo is one state shared by all visitors, and anyone can reset the hero example.
9. Messages are pasted in; there is no chat integration.
10. Built in one day; not security-reviewed or load-tested beyond the checks listed.

## 8. Submission kit (P3, ready by 16:30)

The submission format is unknown until the opening. Have these ready so the presenter (T24b) can fill any form:

- 100-word and 30-word descriptions (from section 1 and the README).
- Live URL; repo URL; video link (upload unlisted if a link is required).
- Five screenshots from `docs/screenshots` (desk planned, confirm dialog, stale, receipt, `/data`).
- A 5-slide deck (problem, demo screenshot with 1/2 vs 2/2, architecture with the trust boundary, tests and data honesty, how Codex was used) built from the README by stretch task S10, promoted from stretch to required if the opening says slides are needed.
