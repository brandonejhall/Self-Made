// Public API of the simulation. The UI and the balance suite import only from here.

import { CONFIG, type CityId } from "./config";
import { nextRandom } from "./rng";
import type { GameState, WeekInput } from "./types";

export type { GameState, WeekInput, HistoryEntry, Asset, Liability } from "./types";
export { CONFIG } from "./config";
import type { Asset, HistoryEntry, Liability } from "./types";

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

  return {
    ...updatedState,
    wealthTier: newWealthTier,
    flags: finalFlags,
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
