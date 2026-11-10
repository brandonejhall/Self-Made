// Public API of the simulation. The UI and the balance suite import only from here.

import { CONFIG, type CityId } from "./config";
import { nextRandom } from "./rng";
import type { GameState, WeekInput } from "./types";

export type { GameState, WeekInput, HistoryEntry, Asset, Liability } from "./types";
export { CONFIG } from "./config";

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

export function validateInput(state: GameState, input: WeekInput): string | null {
  const { work, hustle, rest } = input.hours;
  const study = input.hours.study ?? 0;
  const sideProject = input.hours.sideProject ?? 0;
  if ([work, hustle, rest, study, sideProject].some((h) => h < 0))
    return "Hours cannot be negative";
  if (work + hustle + rest + study + sideProject > CONFIG.time.hoursPerWeek) {
    return `Total hours exceed ${CONFIG.time.hoursPerWeek}`;
  }
  if (state.flags.burnout_active && work + hustle > CONFIG.energy.burnoutMaxHours) {
    return `While burned out, work + hustle cannot exceed ${CONFIG.energy.burnoutMaxHours} hours`;
  }
  return null;
}

// Advance one week. Pure: returns a new state and never mutates the input.
export function step(state: GameState, input: WeekInput): GameState {
  const error = validateInput(state, input);
  if (error) throw new Error(error);

  const city = CONFIG.cities[state.cityId];
  const { work, hustle, rest } = input.hours;
  const study = input.hours.study ?? 0;
  const sideProject = input.hours.sideProject ?? 0;
  const skill = input.hours.skill ?? "";

  // --- Skills increment ---
  const newSkills = { ...state.skills };
  if (study > 0 && skill !== "") {
    newSkills[skill] = (newSkills[skill] ?? 0) + Math.floor(study);
  }

  // --- financial skill unlock flag ---
  let flags = { ...state.flags };
  if ((newSkills["financial"] ?? 0) >= CONFIG.skills.financialBusinessUnlockLevel) {
    flags = { ...flags, skill_financial_unlocked: true };
  }

  // --- Hustle rate with skill-based ceiling and reputation modifier ---
  const [roll, rngState] = nextRandom(state.rngState);
  const hustleCeiling = Math.min(
    city.hustleHourlyMaxUsd + CONFIG.skills.hustleWageCeilingPerPoint * (state.skills["hustle"] ?? 0),
    city.hustleAbsoluteCeiling,
  );
  let hustleRate = city.hustleHourlyMinUsd + roll * (hustleCeiling - city.hustleHourlyMinUsd);

  // Reputation modifier: above 50 adds 1% per point, below 50 subtracts 0.5% per point
  const repDelta = state.reputation - 50;
  const repMult =
    repDelta >= 0
      ? 1 + repDelta * CONFIG.reputation.hustleBonus
      : 1 + repDelta * CONFIG.reputation.hustlePenalty;
  hustleRate = hustleRate * repMult;

  // Burnout productivity penalty applies if energy is below threshold at the START of the week
  const productivityMult =
    state.energy < CONFIG.energy.burnoutThreshold ? CONFIG.energy.burnoutProductivityMult : 1;

  const income =
    work * city.baseHourlyWageUsd * productivityMult + hustle * hustleRate * productivityMult;

  // TODO SM-006: use state.housingTier to select the correct rent tier
  const costs = CONFIG.cities.kingston.housingTiers[0].weeklyRentUsd + city.weeklyLivingCostUsd;

  // Recovery is halved while burnout_active
  const recoveryMult = state.flags.burnout_active ? CONFIG.energy.burnoutRecoveryMult : 1;
  const recovery = rest * CONFIG.energy.restRecoveryPerHour * recoveryMult;
  const drain =
    work * CONFIG.energy.workCostPerHour +
    hustle * CONFIG.energy.hustleCostPerHour +
    study * CONFIG.energy.studyCostPerHour +
    sideProject * CONFIG.energy.sideProjectCostPerHour;

  const newEnergy = clamp(state.energy + recovery - drain, 0, CONFIG.energy.max);

  // burnoutWeeks: count consecutive weeks where energy hits 0
  const burnoutWeeks = newEnergy <= 0 ? state.burnoutWeeks + 1 : 0;

  // burnout_active flag lifecycle
  if (burnoutWeeks >= 2) {
    flags = { ...flags, burnout_active: true };
  }
  if (newEnergy > CONFIG.energy.burnoutClearThreshold && flags.burnout_active) {
    flags = { ...flags, burnout_active: false };
    // burnoutWeeks reset is handled below by using 0
  }
  // If we just cleared burnout, reset burnoutWeeks to 0
  const finalBurnoutWeeks =
    newEnergy > CONFIG.energy.burnoutClearThreshold && state.flags.burnout_active
      ? 0
      : burnoutWeeks;

  const week = state.week + 1;
  return {
    ...state,
    rngState,
    week,
    age: CONFIG.start.age + Math.floor(week / CONFIG.time.weeksPerYear),
    cashUsd: round2(state.cashUsd + income - costs),
    energy: round2(newEnergy),
    burnoutWeeks: finalBurnoutWeeks,
    history: state.history,
    flags,
    skills: newSkills,
  };
}

export function netWorthUsd(state: GameState): number {
  const assetValue = state.assets.reduce((sum, a) => sum + a.bookValueUsd, 0);
  const liabilityValue = state.liabilities.reduce((sum, l) => sum + l.principalUsd, 0);
  return round2(state.cashUsd + assetValue - liabilityValue);
}

export function effectiveLoanApr(state: GameState): number {
  const reduction = (state.skills["negotiation"] ?? 0) * CONFIG.loans.aprReductionPerSkillPoint;
  return Math.max(CONFIG.loans.baseAprPct - reduction, CONFIG.loans.minAprPct);
}

export function effectiveHustleCeiling(state: GameState): number {
  const city = CONFIG.cities[state.cityId];
  return Math.min(
    city.hustleHourlyMaxUsd + CONFIG.skills.hustleWageCeilingPerPoint * (state.skills["hustle"] ?? 0),
    city.hustleAbsoluteCeiling,
  );
}

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string): GameState {
  const parsed = JSON.parse(json) as GameState;
  if (parsed.version !== 1) throw new Error(`Unsupported save version ${parsed.version}`);
  return parsed;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
