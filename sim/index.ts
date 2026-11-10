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
import { STAGE1_COMPLETE_ERROR, endOfRunSystem, isStage1End } from "./systems/endOfRun";

export type {
  GameState,
  WeekInput,
  HistoryEntry,
  Asset,
  Liability,
  GameEvent,
  EventTrigger,
  EventChoice,
  ChoiceLogEntry,
  Stage1Summary,
} from "./types";
export { CONFIG } from "./config";
export { validateInput } from "./systems/input";
export { netWorthUsd } from "./systems/tiers";
export { launchBusiness, reinvestBusiness } from "./systems/business";
export { buyProperty, sellProperty, mortgagePaymentUsd } from "./systems/property";
export { holdJob, quitJob } from "./systems/jobs";
export { effectiveLoanApr, takeLoan } from "./systems/loans";
export { effectiveHustleCeiling } from "./systems/income";
export { moveHousing } from "./systems/housing";
export { loadEvents, selectEvents, applyEvent } from "./systems/events";
export { buildSummary } from "./systems/endOfRun";

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
    stage1Complete: false,
    summary: null,
    choiceLog: [],
    maxWealthTier: 0,
  };
}

// Fixed system order. RNG draws: incomeSystem (1 roll), businessIncomeSystem (1 failure
// roll per owned business, none without a business), propertySystem (1 roll per owned
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

// Advance one week. Throws "Stage 1 is complete" once the run has ended. The week that
// reaches CONFIG.progression.stage1EndWeek sets stage1Complete and summary, and draws no
// events: the run is over, so nothing is left to resolve. Pure: returns a new state and pending events, never mutates the input.
export function step(
  state: GameState,
  input: WeekInput,
  events: GameEvent[] = [],
): { state: GameState; pendingEvents: GameEvent[] } {
  if (state.stage1Complete) throw new Error(STAGE1_COMPLETE_ERROR);
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
  if (isStage1End(ctx.next)) {
    return { state: endOfRunSystem(ctx.next, events), pendingEvents: [] };
  }
  const [finalCtx, pendingEvents] = eventsSystem(ctx, events);

  return { state: finalCtx.next, pendingEvents };
}

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

// Saves made before SM-020 lack the end-of-run fields. Fill them so old saves keep loading.
export function deserialize(json: string): GameState {
  const parsed = JSON.parse(json) as Partial<GameState> & { version: number };
  if (parsed.version !== 1) throw new Error(`Unsupported save version ${parsed.version}`);
  return {
    ...parsed,
    stage1Complete: parsed.stage1Complete ?? false,
    summary: parsed.summary ?? null,
    choiceLog: parsed.choiceLog ?? [],
    maxWealthTier: parsed.maxWealthTier ?? parsed.wealthTier ?? 0,
  } as GameState;
}
