// Single list of every event file. The UI, the CLI and the balance suite load
// events from here, so a new content file reaches the game in one place.
// lore-writer: add every new file in content/events/ to this list.
// `npm run validate` fails if a file in content/events/ is missing here.

import consequence from "./events/stage1_consequence.json";
import family from "./events/stage1_family.json";
import financialOpportunity from "./events/stage1_financial_opportunity.json";
import financialThreat from "./events/stage1_financial_threat.json";
import hustleWork from "./events/stage1_hustle_work.json";
import relationship from "./events/stage1_relationship.json";
import shortcuts from "./events/stage1_shortcuts.json";
import worldClock from "./events/stage1_world_clock.json";

export const EVENT_FILES: Record<string, unknown[]> = {
  "stage1_consequence.json": consequence,
  "stage1_family.json": family,
  "stage1_financial_opportunity.json": financialOpportunity,
  "stage1_financial_threat.json": financialThreat,
  "stage1_hustle_work.json": hustleWork,
  "stage1_relationship.json": relationship,
  "stage1_shortcuts.json": shortcuts,
  "stage1_world_clock.json": worldClock,
};

export const ALL_EVENT_DATA: unknown[] = Object.values(EVENT_FILES).flat();
