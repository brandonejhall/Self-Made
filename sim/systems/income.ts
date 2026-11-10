// Work and hustle income. Draws the week's hustle-rate roll from the RNG.

import { CONFIG } from "../config";
import { nextRandom } from "../rng";
import type { GameState } from "../types";
import type { StepContext } from "../util";
import { jobHourlyWage } from "./jobs";

export function effectiveHustleCeiling(state: GameState): number {
  const city = CONFIG.cities[state.cityId];
  return Math.min(
    city.hustleHourlyMaxUsd + CONFIG.skills.hustleWageCeilingPerPoint * (state.skills["hustle"] ?? 0),
    city.hustleAbsoluteCeiling,
  );
}

// Reputation modifier: above 50 adds 1% per point, below 50 subtracts 0.5% per point
function reputationMultiplier(reputation: number): number {
  const repDelta = reputation - 50;
  return repDelta >= 0
    ? 1 + repDelta * CONFIG.reputation.hustleBonus
    : 1 + repDelta * CONFIG.reputation.hustlePenalty;
}

export function incomeSystem(ctx: StepContext): StepContext {
  const { prev } = ctx;
  const { work, hustle } = ctx.hours;
  const city = CONFIG.cities[prev.cityId];

  // Hustle rate with skill-based ceiling (start-of-week skills) and reputation modifier
  const [roll, rngState] = nextRandom(ctx.next.rngState);
  const hustleCeiling = effectiveHustleCeiling(prev);
  let hustleRate = city.hustleHourlyMinUsd + roll * (hustleCeiling - city.hustleHourlyMinUsd);
  hustleRate = hustleRate * reputationMultiplier(prev.reputation);

  // Burnout productivity penalty applies if energy is below threshold at the START of the week
  const productivityMult =
    prev.energy < CONFIG.energy.burnoutThreshold ? CONFIG.energy.burnoutProductivityMult : 1;

  const jobWage = jobHourlyWage(prev);

  const workHustleIncomeUsd =
    work * jobWage * productivityMult + hustle * hustleRate * productivityMult;

  return { ...ctx, workHustleIncomeUsd, next: { ...ctx.next, rngState } };
}
