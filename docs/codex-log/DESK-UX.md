# DESK-UX · A clearer dispatch decision

21 November 2026, started 15:32 ICT · Codex local, macOS · GPT-6

The product lead asked us to make the desk understandable to dispatchers and judges. The first questions are what happened, who will miss the cutoff, how much it costs to act, and whether the operator should approve.

## บรีฟสำหรับทีมเดโม

- **อ่านข้อความคลัง** วางข้อความในช่องเดียว เดสก์ถามกลับเฉพาะเรื่องที่ยังขาด ผู้ใช้ตอบต่อจากข้อความเดิมหรือกรอกเองได้
- **เช็กที่มา** ดูคลัง สินค้า และช่วงเวลาที่หยิบไม่ได้ เทียบกับข้อความต้นฉบับที่ไฮไลต์ไว้
- **ดูว่าจะทันกี่ใบ** เดโมตามคิวส่งทัน 1 จาก 2 ใบที่ ฿32 แผนจัดคลังใหม่ส่งทัน 2 จาก 2 ใบที่ ฿88 เงินเพิ่ม ฿56 ช่วยให้ #101 ทันรอบ
- **ชั่งความคุ้ม** เปิดช่องเทียบค่าเสียหายจากพลาดรอบแล้วใส่ค่าปรับหรือค่าส่งซ้ำที่ประเมินเอง ความเสียหายจริงยังไม่มีในชุดข้อมูล ผู้ใช้เลือกว่าจะจองอะไร
- **รับข้อมูลใหม่** ถ้าคลังแจ้งเลื่อนเวลา ให้ตรวจรายงานก่อนใช้ข้อมูลใหม่ แล้วเช็กแผนอีกครั้งก่อนจอง

The reply uses the existing interpretation route with the previous text and the operator's answer, within the original 500-character limit. It goes through the existing schema and validation. The cost estimate only compares plans in the browser and does not become an input to the planner or the reservation.

## Verification

- The local application read the supplied Supabase configuration successfully. A live read of “คลัง A หยิบ SKU-X ไม่ได้” asked for the missing time. Appending “ตั้งแต่ 13:00 ถึง 18:00 น.” produced warehouse A, SKU-X and 13:00–18:00, with a quote from the original message. Both responses used `gpt-6-luna`.
- An independent browser run repeated the same flow through the inline reply field with live OpenAI and local memory storage. The UI showed two at-risk orders and ฿56 as the extra cost for one more order to make the cutoff.
- Lint, typecheck, and production build passed. Vitest on the bundled Node 24 runtime passed 347 tests. The 22 opt-in hosted database contracts were skipped.
- Playwright against the local production build passed all 36 checks in 4.7 minutes with the installed Chrome channel. It covered the inline reply, the loss estimate, the desktop and phone desk, WCAG A/AA checks, stale plans, chat-driven replanning, the guided tour, and booking.

[Desktop, 1280px](../screenshots/dispatch-desk-ux-desktop.jpg) · [Phone, 390px](../screenshots/dispatch-desk-ux-mobile.jpg)
