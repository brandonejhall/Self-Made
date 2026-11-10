// Energy: rest recovery, activity drain, and the burnout lifecycle.

import { CONFIG } from "../config";
import { clamp, round2, type StepContext } from "../util";

export function energySystem(ctx: StepContext): StepContext {
  const { prev } = ctx;
  const { work, hustle, rest, study, sideProject } = ctx.hours;

  // Recovery is halved while burnout_active
  const recoveryMult = prev.flags.burnout_active ? CONFIG.energy.burnoutRecoveryMult : 1;
  const recovery = rest * CONFIG.energy.restRecoveryPerHour * recoveryMult;
  const drain =
    work * CONFIG.energy.workCostPerHour +
    hustle * CONFIG.energy.hustleCostPerHour +
    study * CONFIG.energy.studyCostPerHour +
    sideProject * CONFIG.energy.sideProjectCostPerHour;

  const newEnergy = clamp(prev.energy + recovery - drain, 0, CONFIG.energy.max);

  // burnoutWeeks: count consecutive weeks where energy hits 0
  const burnoutWeeks = newEnergy <= 0 ? prev.burnoutWeeks + 1 : 0;

  // burnout_active flag lifecycle
  let flags = ctx.next.flags;
  if (burnoutWeeks >= 2) {
    flags = { ...flags, burnout_active: true };
  }
  if (newEnergy > CONFIG.energy.burnoutClearThreshold && flags.burnout_active) {
    flags = { ...flags, burnout_active: false };
  }
  // If we just cleared burnout, reset burnoutWeeks to 0
  const finalBurnoutWeeks =
    newEnergy > CONFIG.energy.burnoutClearThreshold && prev.flags.burnout_active
      ? 0
      : burnoutWeeks;

  return {
    ...ctx,
    next: { ...ctx.next, energy: round2(newEnergy), burnoutWeeks: finalBurnoutWeeks, flags },
  };
}
