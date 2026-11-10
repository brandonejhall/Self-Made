// Businesses: launch action and weekly passive income.

import { CONFIG } from "../config";
import type { Asset, GameState, HistoryEntry } from "../types";
import { round2, type StepContext } from "../util";

export function businessIncomeSystem(ctx: StepContext): StepContext {
  const businessIncomeUsd = ctx.prev.assets.reduce(
    (sum, a) => sum + (a.weeklyIncomeUsd ?? 0),
    0,
  );
  return { ...ctx, businessIncomeUsd };
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
