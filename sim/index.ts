// Public API of the simulation. The UI and the balance suite import only from here.
// System logic lives in sim/systems/*. This file builds new games, runs the weekly
// pipeline in a fixed order, and handles save/load.

import { CONFIG, type CityId } from "./config";
import type { GameEvent, GameState, WeekInput } from "./types";
import type { StepContext } from "./util";
import { normalizeHours, validateInput } from "./systems/input";
import { skillsSystem } from "./systems/skills";
import { incomeSystem } from "./systems/income";
import { businessIncomeSystem } from "./systems/business";
import { propertySystem } from "./systems/property";
import { housingCostSystem, evictionSystem } from "./systems/housing";
import { loanRepaymentSystem } from "./systems/loans";
import { cashflowSystem } from "./systems/cashflow";
import { jobLossSystem } from "./systems/jobs";
import { energySystem } from "./systems/energy";
import { timeSystem } from "./systems/time";
import { tiersSystem } from "./systems/tiers";
import { eventsSystem } from "./systems/events";

export type { GameState, WeekInput, HistoryEntry, Asset, Liability, GameEvent, EventTrigger, EventChoice } from "./types";
export { CONFIG } from "./config";
export { validateInput } from "./systems/input";
export { netWorthUsd } from "./systems/tiers";
export { launchBusiness } from "./systems/business";
export { buyProperty, sellProperty, mortgagePaymentUsd } from "./systems/property";
export { holdJob, quitJob } from "./systems/jobs";
export { effectiveLoanApr, takeLoan } from "./systems/loans";
export { effectiveHustleCeiling } from "./systems/income";
export { moveHousing } from "./systems/housing";
export { loadEvents, selectEvents, applyEvent } from "./systems/events";

export function newGame(seed: number, cityId: CityId = "kingston"): GameState {
  return {
    version: 1,
    seed,
    rngState: seed >>> 0,
    week: 0,
    age: CONFIG.start.age,
    cityId,
    cashUsd: CONFIG.start.cashUsd,
    energy: CONFIG.start.energy,
    reputation: CONFIG.start.reputation,
    history: [],
    flags: {},
    skills: {},
    trust: {},
    assets: [],
    liabilities: [],
    firedEvents: [],
    housingTier: 0,
    overdueWeeks: 0,
    burnoutWeeks: 0,
    wealthTier: 0,
    activeJobId: null,
    underHoursWeeks: 0,
  };
}

// Fixed system order. RNG draws: incomeSystem (1 roll), propertySystem (1 roll per owned
// property, none when no property is owned), then eventsSystem.
// Reordering changes results; the golden test in tests/sim/golden.test.ts guards it.
const WEEK_PIPELINE: ReadonlyArray<(ctx: StepContext) => StepContext> = [
  skillsSystem,
  incomeSystem,
  businessIncomeSystem,
  propertySystem,
  housingCostSystem,
  loanRepaymentSystem,
  cashflowSystem,
  evictionSystem,
  jobLossSystem,
  energySystem,
  timeSystem,
  tiersSystem,
];

// Advance one week. Pure: returns a new state and pending events, never mutates the input.
export function step(
  state: GameState,
  input: WeekInput,
  events: GameEvent[] = [],
): { state: GameState; pendingEvents: GameEvent[] } {
  const error = validateInput(state, input);
  if (error) throw new Error(error);

  const initial: StepContext = {
    prev: state,
    hours: normalizeHours(input),
    next: { ...state },
    workHustleIncomeUsd: 0,
    businessIncomeUsd: 0,
    housingCostUsd: 0,
    loanPaymentsUsd: 0,
    propertyRentUsd: 0,
    propertyCostsUsd: 0,
  };

  const ctx = WEEK_PIPELINE.reduce((c, system) => system(c), initial);
  const [finalCtx, pendingEvents] = eventsSystem(ctx, events);

  return { state: finalCtx.next, pendingEvents };
}

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string): GameState {
  const parsed = JSON.parse(json) as GameState;
  if (parsed.version !== 1) throw new Error(`Unsupported save version ${parsed.version}`);
  return parsed;
}
