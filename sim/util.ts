// Shared helpers and the per-week pipeline context used by sim/systems/*.

import type { GameState } from "./types";

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Week hours with optional fields resolved to their defaults.
export interface WeekHours {
  work: number;
  hustle: number;
  rest: number;
  study: number;
  sideProject: number;
  skill: string;
}

// Carried through the step() pipeline. Each system takes a context and returns a new one.
// `prev` is the state at the start of the week and never changes during the pipeline.
// `next` accumulates the end-of-week state; `next.rngState` threads the RNG.
export interface StepContext {
  readonly prev: GameState;
  readonly hours: WeekHours;
  next: GameState;
  workHustleIncomeUsd: number;
  businessIncomeUsd: number;
  housingCostUsd: number;
  loanPaymentsUsd: number;
  propertyRentUsd: number;  // SM-016: rent from occupied rental properties
  propertyCostsUsd: number; // SM-016: maintenance plus mortgage payments
}
