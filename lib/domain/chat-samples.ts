export const heroFollowups = [
  { type: "delay", sender: "B", text: "รถสาขา B ออกได้บ่ายสองครึ่ง" },
  { type: "stock_found", sender: "C", text: "คลัง C พบ SKU-X เพิ่มอีก 4 หน่วย" },
  { type: "resumed", sender: "A", text: "คลัง A กลับมาเตรียม SKU-X ได้แล้วตั้งแต่ 13:30 น." },
] as const;
