// Public API of the simulation. The UI and the balance suite import only from here.

import { CONFIG, type CityId } from "./config";
import { nextRandom } from "./rng";
import type { GameState, WeekInput } from "./types";

export type { GameState, WeekInput, HistoryEntry, Asset, Liability, GameEvent, EventTrigger, EventChoice } from "./types";
export { CONFIG } from "./config";
import type { Asset, HistoryEntry, Liability, GameEvent, EventChoice } from "./types";

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

// Advance one week. Pure: returns a new state and pending events, never mutates the input.
export function step(
  state: GameState,
  input: WeekInput,
  events: GameEvent[] = [],
): { state: GameState; pendingEvents: GameEvent[] } {
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

  const workHustleIncome =
    work * city.baseHourlyWageUsd * productivityMult + hustle * hustleRate * productivityMult;

  // Passive income from business assets
  const businessIncome = state.assets.reduce(
    (sum, a) => sum + (a.weeklyIncomeUsd ?? 0),
    0,
  );

  const income = workHustleIncome + businessIncome;

  const rent = CONFIG.cities.kingston.housingTiers[state.housingTier]!.weeklyRentUsd;
  const costs = rent + city.weeklyLivingCostUsd;

  // Process loan repayments
  let loanPayments = 0;
  const updatedLiabilities = state.liabilities.map((l) => {
    loanPayments += l.weeklyPaymentUsd;
    return { ...l, weeksRemaining: l.weeksRemaining - 1 };
  });
  const remainingLiabilities = updatedLiabilities.filter((l) => l.weeksRemaining > 0);
  const totalCosts = costs + loanPayments;

  // --- Eviction check ---
  const newCashAfterAll = round2(state.cashUsd + income - totalCosts);

  let overdueWeeks = state.overdueWeeks;
  let housingTier = state.housingTier;
  let trust = { ...state.trust };
  let postStepLiabilities = [...remainingLiabilities];
  let stepHistory: HistoryEntry[] = [...state.history];

  if (newCashAfterAll < CONFIG.progression.overdueCashFloor) {
    overdueWeeks += 1;
  } else {
    overdueWeeks = 0;
  }

  if (overdueWeeks >= CONFIG.progression.evictionOverdueCount) {
    const overdueRent =
      CONFIG.cities.kingston.housingTiers[state.housingTier]!.weeklyRentUsd * 2;
    const forcedWeeks = Math.ceil(
      overdueRent / CONFIG.progression.evictionForcedRepayPerWeek,
    );
    stepHistory = [
      ...stepHistory,
      { week: state.week + 1, action: "evicted", tags: ["evicted"] },
    ];
    trust = {
      ...trust,
      halima_yusuf: (trust["halima_yusuf"] ?? 0) - 20,
    };
    postStepLiabilities = [
      ...postStepLiabilities,
      {
        id: `eviction_repay_${state.week + 1}`,
        principalUsd: overdueRent,
        weeklyPaymentUsd: CONFIG.progression.evictionForcedRepayPerWeek,
        weeksRemaining: forcedWeeks,
      },
    ];
    housingTier = 0;
    overdueWeeks = 0;
  }

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

  // Build intermediate state to compute final net worth for wealthTier
  const updatedState = {
    ...state,
    rngState,
    week,
    age: CONFIG.start.age + Math.floor(week / CONFIG.time.weeksPerYear),
    cashUsd: newCashAfterAll,
    energy: round2(newEnergy),
    burnoutWeeks: finalBurnoutWeeks,
    history: stepHistory,
    flags,
    skills: newSkills,
    liabilities: postStepLiabilities,
    overdueWeeks,
    housingTier,
    trust,
  };

  // Recalculate wealthTier from final net worth
  const finalNetWorth = netWorthUsd(updatedState);
  const newWealthTier = computeWealthTier(finalNetWorth);
  const finalFlags =
    newWealthTier >= 2
      ? { ...flags, stage2_unlocked: true }
      : flags;

  const finalStateBeforeEvents: GameState = {
    ...updatedState,
    wealthTier: newWealthTier,
    flags: finalFlags,
  };

  const [pendingEvents, finalRngState] = selectEvents(
    finalStateBeforeEvents,
    events,
    finalStateBeforeEvents.rngState,
  );

  return {
    state: { ...finalStateBeforeEvents, rngState: finalRngState },
    pendingEvents,
  };
}

export function netWorthUsd(state: GameState): number {
  const assetValue = state.assets.reduce((sum, a) => sum + a.bookValueUsd, 0);
  const liabilityValue = state.liabilities.reduce((sum, l) => sum + l.principalUsd, 0);
  return round2(state.cashUsd + assetValue - liabilityValue);
}

function computeWealthTier(nw: number): number {
  if (nw >= CONFIG.progression.tier2Threshold) return 2;
  if (nw >= CONFIG.progression.tier1Threshold) return 1;
  return 0;
}

export function launchBusiness(
  state: GameState,
  businessTypeId: string,
): [GameState, string | null] {
  if (state.wealthTier < 1) {
    return [state, "Business launch requires Tier 1 (net worth >= $10,000)"];
  }
  if (!state.flags.skill_financial_unlocked) {
    return [state, "Business launch requires financial skill >= 3"];
  }
  const bizType = CONFIG.businesses.types.find((b) => b.id === businessTypeId);
  if (!bizType) {
    return [state, `Unknown business type: ${businessTypeId}`];
  }
  if (state.cashUsd < bizType.launchCostUsd) {
    return [state, `Need $${bizType.launchCostUsd} to launch ${businessTypeId}`];
  }

  const asset: Asset = {
    id: `biz_${businessTypeId}_${state.week}`,
    type: businessTypeId,
    bookValueUsd: bizType.launchCostUsd,
    weeklyIncomeUsd: bizType.weeklyIncomeUsd,
  };

  const newHistory: HistoryEntry[] = [
    ...state.history,
    {
      week: state.week,
      action: `launched_business_${businessTypeId}`,
      tags: [`launched_${businessTypeId}`],
    },
  ];

  return [
    {
      ...state,
      cashUsd: round2(state.cashUsd - bizType.launchCostUsd),
      assets: [...state.assets, asset],
      history: newHistory,
    },
    null,
  ];
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

export function takeLoan(
  state: GameState,
  amount: number,
  termWeeks: number,
): [GameState, string | null] {
  // Eligibility: reputation must be >= CONFIG.loans.minReputation
  // UNLESS cash <= CONFIG.loans.emergencyMinCash (emergency override)
  const isEmergency = state.cashUsd <= CONFIG.loans.emergencyMinCash;
  if (!isEmergency && state.reputation < CONFIG.loans.minReputation) {
    return [
      state,
      `Reputation ${state.reputation} below minimum ${CONFIG.loans.minReputation}`,
    ];
  }

  // Max simultaneous loans check
  const maxLoans = CONFIG.loans.maxSimultaneous[state.wealthTier] ?? 1;
  if (state.liabilities.length >= maxLoans) {
    return [
      state,
      `Cannot hold more than ${maxLoans} simultaneous loans at tier ${state.wealthTier}`,
    ];
  }

  // Compute weekly payment using amortization formula
  const apr = effectiveLoanApr(state);
  const weeklyRate = apr / 52 / 100;
  let weeklyPayment: number;
  if (weeklyRate === 0) {
    weeklyPayment = Math.round((amount / termWeeks) * 100) / 100;
  } else {
    weeklyPayment =
      Math.round(
        ((amount * weeklyRate) / (1 - Math.pow(1 + weeklyRate, -termWeeks))) * 100,
      ) / 100;
  }

  const liability: Liability = {
    id: `loan_${state.week}_${amount}`,
    principalUsd: amount,
    weeklyPaymentUsd: weeklyPayment,
    weeksRemaining: termWeeks,
  };

  const newHistory: HistoryEntry[] = [
    ...state.history,
    { week: state.week, action: `took_loan_${amount}`, tags: ["took_loan"] },
  ];

  return [
    {
      ...state,
      cashUsd: round2(state.cashUsd + amount),
      liabilities: [...state.liabilities, liability],
      history: newHistory,
    },
    null,
  ];
}

export function moveHousing(
  state: GameState,
  newTier: number,
): [GameState, string | null] {
  const tiers = CONFIG.cities.kingston.housingTiers;
  if (newTier < 0 || newTier >= tiers.length) {
    return [state, `Invalid housing tier ${newTier}`];
  }
  const tier = tiers[newTier]!;
  if (state.cashUsd < tier.cashRequiredUsd) {
    return [state, `Need $${tier.cashRequiredUsd} cash to access tier ${newTier}`];
  }
  if (state.cashUsd < tier.depositUsd) {
    return [state, `Need $${tier.depositUsd} for deposit`];
  }
  return [
    {
      ...state,
      cashUsd: round2(state.cashUsd - tier.depositUsd),
      housingTier: newTier,
    },
    null,
  ];
}

// --- Event engine ---

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

  return s;
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
