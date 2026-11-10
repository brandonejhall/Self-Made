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
  kind?: "business" | "property";
  // SM-017 business growth. Set on assets created by launchBusiness.
  stage?: number; // 1 to 4
  weeksAtStage?: number;
  reinvestedAtStageUsd?: number;
  // SM-016 rental property fields. Property rent lives in weeklyRentUsd, never weeklyIncomeUsd,
  // so the business income sum does not count it.
  weeklyRentUsd?: number;
  occupied?: boolean;
  vacantWeeksRemaining?: number;
  purchaseWeek?: number;
}

export interface Liability {
  id: string;
  principalUsd: number;
  weeklyPaymentUsd: number;
  weeksRemaining: number;
  // SM-016: mortgages are settled by the property system, not loan repayment,
  // and do not count toward loans.maxSimultaneous.
  kind?: "loan" | "mortgage";
  propertyId?: string;
  aprPct?: number;
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
  // SM-020 end of run. deserialize fills these for saves made before SM-020.
  stage1Complete: boolean;
  summary: Stage1Summary | null;
  choiceLog: ChoiceLogEntry[];
  maxWealthTier: number; // highest wealthTier held at any step
}

// One resolved event choice and its net worth effect (GDD 15.1).
export interface ChoiceLogEntry {
  week: number;
  eventId: string;
  choiceIndex: number;
  netWorthDeltaUsd: number; // netWorthUsd(after applyEvent) - netWorthUsd(before)
}

// Age-30 summary, set by step() when the run reaches CONFIG.progression.stage1EndWeek.
export interface Stage1Summary {
  finalNetWorthUsd: number;
  wealthTierReached: number;
  topChoices: ChoiceLogEntry[];
  consequencesFired: string[];
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
