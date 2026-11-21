import "server-only";
import { heroEventChanges, heroSampleMessages, heroSnapshot } from "./hero";

export const scenarioRegistry = {
  hero: { snapshot: heroSnapshot, sampleMessages: heroSampleMessages, eventChanges: heroEventChanges },
};
