// End of Stage 1 (GDD 15.1): the run stops at CONFIG.progression.stage1EndWeek and the
// state carries the age-30 summary.

import { CONFIG } from "../config";
import type { ChoiceLogEntry, GameEvent, GameState, Stage1Summary } from "../types";
import { netWorthUsd } from "./tiers";

export const STAGE1_COMPLETE_ERROR = "Stage 1 is complete";

export function isStage1End(state: GameState): boolean {
  return state.week >= CONFIG.progression.stage1EndWeek;
}

// Largest |netWorthDeltaUsd| first. Ties: earlier week, then earlier log position.
export function topChoices(choiceLog: ChoiceLogEntry[], n: number): ChoiceLogEntry[] {
  return choiceLog
    .map((entry, idx) => ({ entry, idx }))
    .sort(
      (a, b) =>
        Math.abs(b.entry.netWorthDeltaUsd) - Math.abs(a.entry.netWorthDeltaUsd) ||
        a.entry.week - b.entry.week ||
        a.idx - b.idx,
    )
    .slice(0, n)
    .map(({ entry }) => ({ ...entry }));
}

// Fired event ids whose trigger sets minYearsAfterTag (delayed consequences, GDD 11), in firing order.
export function consequencesFired(state: GameState, events: GameEvent[]): string[] {
  const delayed = new Set(
    events.filter((e) => e.trigger.minYearsAfterTag !== undefined).map((e) => e.id),
  );
  return state.firedEvents.filter((id) => delayed.has(id));
}

export function buildSummary(state: GameState, events: GameEvent[]): Stage1Summary {
  return {
    finalNetWorthUsd: netWorthUsd(state),
    wealthTierReached: Math.max(state.maxWealthTier, state.wealthTier),
    topChoices: topChoices(state.choiceLog, CONFIG.progression.summaryTopChoices),
    consequencesFired: consequencesFired(state, events),
  };
}

// Runs after the weekly pipeline. Marks the run complete and writes the summary at the end week.
export function endOfRunSystem(state: GameState, events: GameEvent[]): GameState {
  if (!isStage1End(state)) return state;
  return { ...state, stage1Complete: true, summary: buildSummary(state, events) };
}
