import "server-only";
import data from "@/data/derived/day-2011-11-22.json";
import { realDaySamples, realDaySnapshot } from "./realDayFormat";

export const realDay = {
  snapshot: realDaySnapshot(data),
  sampleMessages: realDaySamples,
  eventChanges: {},
};
