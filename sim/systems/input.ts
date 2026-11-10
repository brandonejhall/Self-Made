// Input validation and normalization for a week's hour allocation.

import { CONFIG } from "../config";
import type { GameState, WeekInput } from "../types";
import type { WeekHours } from "../util";
import { findJob } from "./jobs";

export function normalizeHours(input: WeekInput): WeekHours {
  const { work, hustle, rest } = input.hours;
  return {
    work,
    hustle,
    rest,
    study: input.hours.study ?? 0,
    sideProject: input.hours.sideProject ?? 0,
    skill: input.hours.skill ?? "",
  };
}

export function validateInput(state: GameState, input: WeekInput): string | null {
  const { work, hustle, rest, study, sideProject } = normalizeHours(input);
  if ([work, hustle, rest, study, sideProject].some((h) => h < 0))
    return "Hours cannot be negative";
  if (work + hustle + rest + study + sideProject > CONFIG.time.hoursPerWeek) {
    return `Total hours exceed ${CONFIG.time.hoursPerWeek}`;
  }
  if (state.flags.burnout_active && work + hustle > CONFIG.energy.burnoutMaxHours) {
    return `While burned out, work + hustle cannot exceed ${CONFIG.energy.burnoutMaxHours} hours`;
  }
  // Full-time job hustle cap: > 20 hustle hours not allowed
  if (state.activeJobId) {
    const job = findJob(state.activeJobId);
    if (job && job.minCommitHours >= 40 && hustle > 20) {
      return 'Full-time job limits hustle to 20 hours per week';
    }
  }
  return null;
}
