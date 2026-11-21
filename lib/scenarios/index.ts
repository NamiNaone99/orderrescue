import "server-only";
import { scenarioRegistry as hero } from "./heroRegistry";
import { realDay } from "./realDay";

export const scenarioRegistry = {
  "real-day": realDay,
  ...hero,
};
