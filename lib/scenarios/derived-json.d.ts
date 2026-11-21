// Typecheck both checkout shapes. The runtime registry includes this module only when the file exists.
declare module "@/data/derived/day-2011-11-22.json" {
  const day: ReturnType<typeof import("../../scripts/derive-retail-day").deriveDay>;
  export default day;
}
