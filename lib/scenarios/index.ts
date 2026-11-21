import "server-only";
import { heroEventChanges, heroSampleMessages, heroSnapshot } from "./hero";
import { realDay } from "./realDay";

export const scenarioRegistry = {
  "real-day": realDay,
  hero: {
    snapshot: heroSnapshot,
    sampleMessages: heroSampleMessages,
    eventChanges: heroEventChanges,
  },
};
