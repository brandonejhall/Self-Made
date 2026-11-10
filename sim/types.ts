import type { CityId } from "./config";

export interface EventTrigger {
  cities?: string[];
  minAge?: number;
  maxAge?: number;
  minCashUsd?: number;
  maxCashUsd?: number;
  minWeek?: number;
  requiresTags?: string[];
  forbidsTags?: string[];
  minYearsAfterTag?: number;
  weight?: number;
  once?: boolean;
}

export interface EventChoice {
  label: string;
  effects: {
    cashUsd?: number;
    energy?: number;
    reputation?: number;
    trust?: Record<string, number>;
    addTags?: string[];
    setFlags?: string[];
  };
}

export interface GameEvent {
  id: string;
  stage: number;
  channel?: string;
  title: string;
  body: string;
  trigger: EventTrigger;
  choices: EventChoice[];
}

export interface HistoryEntry {
  week: number;
  action: string;
  tags: string[];
}

export interface Asset {
  id: string;
  type: string;
  bookValueUsd: number;
  weeklyIncomeUsd?: number; // for businesses / rental
}

export interface Liability {
  id: string;
  principalUsd: number;
  weeklyPaymentUsd: number;
  weeksRemaining: number;
}

export interface GameState {
  version: 1;
  seed: number;
  rngState: number;
  week: number; // weeks since game start
  age: number;
  cityId: CityId;
  cashUsd: number;
  energy: number;
  reputation: number;
  history: HistoryEntry[];
  flags: Record<string, boolean>;
  skills: Record<string, number>;
  trust: Record<string, number>;
  assets: Asset[];
  liabilities: Liability[];
  firedEvents: string[];
  housingTier: number;
  overdueWeeks: number;
  burnoutWeeks: number;
  wealthTier: number;
  activeJobId: string | null;
  underHoursWeeks: number;
}

export interface WeekInput {
  hours: {
    work: number;
    hustle: number;
    rest: number;
    study?: number;      // defaults to 0 when omitted
    sideProject?: number; // defaults to 0 when omitted
    skill?: string;      // which skill study hours go toward; omit or empty string means no skill study
  };
}
