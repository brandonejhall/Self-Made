// Event engine: content loading, trigger matching, weighted selection, choice effects.

import { CONFIG } from "../config";
import { nextRandom } from "../rng";
import type { EventChoice, GameEvent, GameState, HistoryEntry } from "../types";
import { clamp, round2, type StepContext } from "../util";
import { netWorthUsd } from "./tiers";

// Draws this week's pending events. Runs last so triggers see the end-of-week state.
export function eventsSystem(
  ctx: StepContext,
  events: GameEvent[],
): [StepContext, GameEvent[]] {
  const [pendingEvents, rngState] = selectEvents(ctx.next, events, ctx.next.rngState);
  return [{ ...ctx, next: { ...ctx.next, rngState } }, pendingEvents];
}

export function loadEvents(eventJsonArray: unknown[]): GameEvent[] {
  return eventJsonArray.map((item, idx) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error(`Event at index ${idx} is not an object`);
    }
    const e = item as Record<string, unknown>;

    const id = e["id"];
    const idLabel = typeof id === "string" ? `"${id}"` : `index ${idx}`;

    if (typeof id !== "string" || !/^[a-z0-9_]+$/.test(id)) {
      throw new Error(`Event at ${idLabel} has invalid or missing id`);
    }
    if (!Number.isInteger(e["stage"])) {
      throw new Error(`Event ${idLabel} has invalid or missing stage (must be integer)`);
    }
    if (typeof e["title"] !== "string") {
      throw new Error(`Event ${idLabel} has invalid or missing title`);
    }
    if (typeof e["body"] !== "string") {
      throw new Error(`Event ${idLabel} has invalid or missing body`);
    }
    if (typeof e["trigger"] !== "object" || e["trigger"] === null || Array.isArray(e["trigger"])) {
      throw new Error(`Event ${idLabel} has invalid or missing trigger`);
    }
    if (
      !Array.isArray(e["choices"]) ||
      (e["choices"] as unknown[]).length < 2 ||
      (e["choices"] as unknown[]).length > 4
    ) {
      throw new Error(`Event ${idLabel} choices must be an array of 2–4 items`);
    }
    const choices = e["choices"] as unknown[];
    for (let ci = 0; ci < choices.length; ci++) {
      const choice = choices[ci];
      if (typeof choice !== "object" || choice === null) {
        throw new Error(`Event ${idLabel} choice ${ci} is not an object`);
      }
      const c = choice as Record<string, unknown>;
      if (typeof c["label"] !== "string") {
        throw new Error(`Event ${idLabel} choice ${ci} has invalid or missing label`);
      }
      if (typeof c["effects"] !== "object" || c["effects"] === null || Array.isArray(c["effects"])) {
        throw new Error(`Event ${idLabel} choice ${ci} has invalid or missing effects`);
      }
    }

    return e as unknown as GameEvent;
  });
}

export function selectEvents(
  state: GameState,
  events: GameEvent[],
  rngState: number,
): [GameEvent[], number] {
  // Build a flat set of all tags that appear in history
  const allTags = new Set<string>(state.history.flatMap((h) => h.tags));

  // Filter events by trigger conditions
  const eligible = events.filter((event) => {
    const { trigger } = event;

    if (trigger.minWeek !== undefined && state.week < trigger.minWeek) return false;
    if (trigger.minAge !== undefined && state.age < trigger.minAge) return false;
    if (trigger.maxAge !== undefined && state.age > trigger.maxAge) return false;
    if (trigger.minCashUsd !== undefined && state.cashUsd < trigger.minCashUsd) return false;
    if (trigger.maxCashUsd !== undefined && state.cashUsd > trigger.maxCashUsd) return false;
    if (trigger.cities !== undefined && !trigger.cities.includes(state.cityId)) return false;

    if (trigger.requiresTags !== undefined) {
      for (const tag of trigger.requiresTags) {
        if (!allTags.has(tag)) return false;
      }
    }

    if (trigger.forbidsTags !== undefined) {
      for (const tag of trigger.forbidsTags) {
        if (allTags.has(tag)) return false;
      }
    }

    if (trigger.once === true && state.firedEvents.includes(event.id)) return false;

    if (trigger.minYearsAfterTag !== undefined && trigger.requiresTags !== undefined) {
      const minWeeksAgo = trigger.minYearsAfterTag * CONFIG.time.weeksPerYear;
      for (const tag of trigger.requiresTags) {
        // Find the EARLIEST history entry that contains this tag
        const earliestEntry = state.history.find((h) => h.tags.includes(tag));
        if (!earliestEntry) return false;
        if (state.week - earliestEntry.week < minWeeksAgo) return false;
      }
    }

    return true;
  });

  // Weighted random selection without replacement, up to maxPerWeek
  const selected: GameEvent[] = [];
  const pool = [...eligible];
  let currentRng = rngState;

  while (selected.length < CONFIG.events.maxPerWeek && pool.length > 0) {
    const totalWeight = pool.reduce(
      (sum, e) => sum + (e.trigger.weight ?? CONFIG.events.defaultWeight),
      0,
    );
    const [roll, nextRng] = nextRandom(currentRng);
    currentRng = nextRng;

    let target = roll * totalWeight;
    let selectedIdx = -1;
    let cumulative = 0;

    for (let i = 0; i < pool.length; i++) {
      cumulative += pool[i]!.trigger.weight ?? CONFIG.events.defaultWeight;
      if (cumulative > target) {
        selectedIdx = i;
        break;
      }
    }
    // Floating-point edge case: if no bracket was crossed, pick the last event
    if (selectedIdx === -1) selectedIdx = pool.length - 1;

    selected.push(pool[selectedIdx]!);
    pool.splice(selectedIdx, 1);
  }

  return [selected, currentRng];
}

export function applyEvent(
  state: GameState,
  eventId: string,
  choiceIndex: number,
  events: GameEvent[],
): GameState {
  const event = events.find((e) => e.id === eventId);
  if (!event) throw new Error(`Event not found: ${eventId}`);
  if (choiceIndex < 0 || choiceIndex >= event.choices.length) {
    throw new Error(`Choice index ${choiceIndex} out of range for event "${eventId}"`);
  }

  const choice = event.choices[choiceIndex] as EventChoice;
  const { effects } = choice;

  let s: GameState = { ...state };

  if (effects.cashUsd !== undefined) {
    s = { ...s, cashUsd: round2(s.cashUsd + effects.cashUsd) };
  }
  if (effects.energy !== undefined) {
    s = { ...s, energy: clamp(s.energy + effects.energy, 0, 100) };
  }
  if (effects.reputation !== undefined) {
    s = { ...s, reputation: clamp(s.reputation + effects.reputation, 0, 100) };
  }
  if (effects.trust !== undefined) {
    const newTrust = { ...s.trust };
    for (const [key, delta] of Object.entries(effects.trust)) {
      newTrust[key] = (newTrust[key] ?? 0) + delta;
    }
    s = { ...s, trust: newTrust };
  }
  if (effects.setFlags !== undefined) {
    const newFlags = { ...s.flags };
    for (const flag of effects.setFlags) {
      newFlags[flag] = true;
    }
    s = { ...s, flags: newFlags };
  }
  if (effects.addTags !== undefined) {
    const entry: HistoryEntry = {
      week: s.week,
      action: eventId,
      tags: effects.addTags,
    };
    s = { ...s, history: [...s.history, entry] };
  }

  s = { ...s, firedEvents: [...s.firedEvents, eventId] };

  // SM-020: log the choice and its net worth effect for the age-30 summary.
  const netWorthDeltaUsd = round2(netWorthUsd(s) - netWorthUsd(state));
  s = {
    ...s,
    choiceLog: [...s.choiceLog, { week: s.week, eventId, choiceIndex, netWorthDeltaUsd }],
  };

  return s;
}
