// Housing: rent and living costs, move action, overdue tracking and eviction.

import { CONFIG } from "../config";
import type { GameState } from "../types";
import { round2, type StepContext } from "../util";

export function housingCostSystem(ctx: StepContext): StepContext {
  const city = CONFIG.cities[ctx.prev.cityId];
  const rent = CONFIG.cities.kingston.housingTiers[ctx.prev.housingTier]!.weeklyRentUsd;
  const housingCostUsd = rent + city.weeklyLivingCostUsd;
  return { ...ctx, housingCostUsd };
}

// Runs after cashflowSystem: reads end-of-week cash to track overdue weeks.
export function evictionSystem(ctx: StepContext): StepContext {
  const { prev } = ctx;
  let overdueWeeks = prev.overdueWeeks;
  let housingTier = prev.housingTier;
  let trust = { ...ctx.next.trust };
  let liabilities = [...ctx.next.liabilities];
  let history = [...ctx.next.history];

  if (ctx.next.cashUsd < CONFIG.progression.overdueCashFloor) {
    overdueWeeks += 1;
  } else {
    overdueWeeks = 0;
  }

  if (overdueWeeks >= CONFIG.progression.evictionOverdueCount) {
    const overdueRent =
      CONFIG.cities.kingston.housingTiers[prev.housingTier]!.weeklyRentUsd * 2;
    const forcedWeeks = Math.ceil(
      overdueRent / CONFIG.progression.evictionForcedRepayPerWeek,
    );
    history = [
      ...history,
      { week: prev.week + 1, action: "evicted", tags: ["evicted"] },
    ];
    trust = {
      ...trust,
      halima_yusuf: (trust["halima_yusuf"] ?? 0) - 20,
    };
    liabilities = [
      ...liabilities,
      {
        id: `eviction_repay_${prev.week + 1}`,
        principalUsd: overdueRent,
        weeklyPaymentUsd: CONFIG.progression.evictionForcedRepayPerWeek,
        weeksRemaining: forcedWeeks,
      },
    ];
    housingTier = 0;
    overdueWeeks = 0;
  }

  return {
    ...ctx,
    next: { ...ctx.next, overdueWeeks, housingTier, trust, liabilities, history },
  };
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
