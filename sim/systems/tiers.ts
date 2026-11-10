// Wealth tiers: net worth and tier unlocks.

import { CONFIG } from "../config";
import type { GameState } from "../types";
import { round2, type StepContext } from "../util";

export function netWorthUsd(state: GameState): number {
  const assetValue = state.assets.reduce((sum, a) => sum + a.bookValueUsd, 0);
  const liabilityValue = state.liabilities.reduce((sum, l) => sum + l.principalUsd, 0);
  return round2(state.cashUsd + assetValue - liabilityValue);
}

export function computeWealthTier(nw: number): number {
  if (nw >= CONFIG.progression.tier2Threshold) return 2;
  if (nw >= CONFIG.progression.tier1Threshold) return 1;
  return 0;
}

export function tiersSystem(ctx: StepContext): StepContext {
  const wealthTier = computeWealthTier(netWorthUsd(ctx.next));
  const flags =
    wealthTier >= 2
      ? { ...ctx.next.flags, stage2_unlocked: true }
      : ctx.next.flags;
  const maxWealthTier = Math.max(ctx.prev.maxWealthTier, wealthTier);
  return { ...ctx, next: { ...ctx.next, wealthTier, maxWealthTier, flags } };
}
