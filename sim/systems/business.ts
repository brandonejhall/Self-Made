// Businesses: launch and reinvest actions, weekly passive income, growth stages and failure (GDD 8.4).

import { CONFIG } from "../config";
import { nextRandom } from "../rng";
import type { Asset, GameState, HistoryEntry } from "../types";
import { clamp, round2, type StepContext } from "../util";

export const BUSINESS_KIND = "business";

export function isBusiness(asset: Asset): boolean {
  return asset.kind === BUSINESS_KIND;
}

function stageConfig(stage: number) {
  return CONFIG.businesses.stages[stage - 1];
}

function baseWeeklyIncome(businessTypeId: string): number | null {
  const bizType = CONFIG.businesses.types.find((b) => b.id === businessTypeId);
  return bizType ? bizType.weeklyIncomeUsd : null;
}

// Weekly business pass. Order inside the system:
// 1. Income is the sum of start-of-week asset income (a business that grows or fails
//    this week still pays this week at its start-of-week rate).
// 2. For each business, in asset order: one failure draw at its start-of-week stage.
//    Failed businesses are removed. Survivors gain 1 week at stage, then advance
//    at most one stage if both thresholds for the next stage are met.
// RNG is drawn once per business, so states without a business keep their RNG sequence.
export function businessIncomeSystem(ctx: StepContext): StepContext {
  const businessIncomeUsd = ctx.prev.assets.reduce(
    (sum, a) => sum + (a.weeklyIncomeUsd ?? 0),
    0,
  );
  return businessGrowthSystem({ ...ctx, businessIncomeUsd });
}

function businessGrowthSystem(ctx: StepContext): StepContext {
  const { prev } = ctx;
  if (!ctx.next.assets.some(isBusiness)) return ctx;

  const weekTag = prev.week + 1;
  const burnout = prev.energy < CONFIG.energy.burnoutThreshold;
  let rngState = ctx.next.rngState;
  let reputation = ctx.next.reputation;
  const history: HistoryEntry[] = [...ctx.next.history];
  const assets: Asset[] = [];

  for (const asset of ctx.next.assets) {
    if (!isBusiness(asset)) {
      assets.push(asset);
      continue;
    }
    const stage = asset.stage ?? 1;
    const cfg = stageConfig(stage);
    if (!cfg) throw new Error(`Business ${asset.id} has invalid stage ${stage}`);

    const [draw, s] = nextRandom(rngState);
    rngState = s;
    const chance = cfg.weeklyFailureChance * (burnout ? CONFIG.businesses.burnoutFailureMult : 1);
    if (draw < chance) {
      const tag = `lost_business_${asset.type}`;
      history.push({ week: weekTag, action: tag, tags: [tag] });
      reputation = clamp(reputation - CONFIG.businesses.failureReputationPenalty, 0, Infinity);
      continue;
    }

    const weeksAtStage = (asset.weeksAtStage ?? 0) + 1;
    const reinvested = asset.reinvestedAtStageUsd ?? 0;
    const nextCfg = stageConfig(stage + 1);
    const base = baseWeeklyIncome(asset.type);
    if (
      nextCfg &&
      base !== null &&
      weeksAtStage >= nextCfg.minWeeksToEnter &&
      reinvested >= nextCfg.reinvestToEnterUsd
    ) {
      const newStage = stage + 1;
      const tag = `grew_${asset.type}_stage${newStage}`;
      history.push({ week: weekTag, action: tag, tags: [tag] });
      assets.push({
        ...asset,
        stage: newStage,
        weeksAtStage: 0,
        reinvestedAtStageUsd: 0,
        weeklyIncomeUsd: round2(base * nextCfg.incomeMult),
      });
    } else {
      assets.push({ ...asset, stage, weeksAtStage, reinvestedAtStageUsd: reinvested });
    }
  }

  return { ...ctx, next: { ...ctx.next, assets, history, reputation, rngState } };
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
    kind: BUSINESS_KIND,
    stage: 1,
    weeksAtStage: 0,
    reinvestedAtStageUsd: 0,
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

// Player action: put cash into a business toward its next stage. Growth itself happens in step().
export function reinvestBusiness(
  state: GameState,
  assetId: string,
  amountUsd: number,
): [GameState, string | null] {
  const idx = state.assets.findIndex((a) => a.id === assetId);
  if (idx < 0) return [state, `Unknown asset: ${assetId}`];
  const asset = state.assets[idx]!;
  if (!isBusiness(asset)) return [state, `Asset ${assetId} is not a business`];
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return [state, "Reinvestment amount must be greater than 0"];
  }
  if (state.cashUsd < amountUsd) {
    return [state, `Need $${amountUsd} cash to reinvest (have $${state.cashUsd})`];
  }
  const stage = asset.stage ?? 1;
  if (stage >= CONFIG.businesses.stages.length) {
    return [state, `Business ${assetId} is already at the top stage`];
  }

  const updated: Asset = {
    ...asset,
    stage,
    weeksAtStage: asset.weeksAtStage ?? 0,
    reinvestedAtStageUsd: round2((asset.reinvestedAtStageUsd ?? 0) + amountUsd),
    bookValueUsd: round2(asset.bookValueUsd + amountUsd),
  };
  const assets = state.assets.map((a, i) => (i === idx ? updated : a));

  return [
    {
      ...state,
      cashUsd: round2(state.cashUsd - amountUsd),
      assets,
      history: [
        ...state.history,
        {
          week: state.week,
          action: `reinvested_business_${asset.type}`,
          tags: [`reinvested_${asset.type}`],
        },
      ],
    },
    null,
  ];
}
