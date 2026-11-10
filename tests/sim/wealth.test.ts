import { describe, expect, it } from "vitest";
import {
  CONFIG,
  newGame,
  netWorthUsd,
  step,
  launchBusiness,
  type GameState,
  type Asset,
  type Liability,
  type WeekInput,
} from "../../sim";

// Helper: build a WeekInput with defaults
function makeInput(overrides: Partial<WeekInput["hours"]> = {}): WeekInput {
  return {
    hours: {
      work: 0,
      hustle: 0,
      rest: 100,
      study: 0,
      sideProject: 0,
      skill: "",
      ...overrides,
    },
  };
}

// Helper: override specific GameState fields on top of a fresh game
function withState(overrides: Partial<GameState>): GameState {
  return { ...newGame(42), ...overrides };
}

describe("wealthTier recalculation in step()", () => {
  it("wealthTier is 0 when net worth < $10,000", () => {
    // Start with cash below tier 1 threshold, no assets or liabilities
    const state = withState({ cashUsd: 5000, assets: [], liabilities: [] });
    const { state: next } = step(state, makeInput());
    expect(next.wealthTier).toBe(0);
  });

  it("wealthTier is 1 when net worth >= $10,000 and < $1,000,000", () => {
    // Set cash above tier 1 but well below tier 2
    const state = withState({ cashUsd: 50000, assets: [], liabilities: [] });
    const { state: next } = step(state, makeInput());
    expect(next.wealthTier).toBe(1);
  });

  it("wealthTier is 2 when net worth >= $1,000,000", () => {
    // Need enough cash to remain >= 1,000,000 after weekly rent ($90) + living ($60) = $150
    const state = withState({ cashUsd: 1_001_000, assets: [], liabilities: [] });
    const { state: next } = step(state, makeInput());
    expect(next.wealthTier).toBe(2);
  });

  it("wealthTier can decrease when net worth drops below threshold", () => {
    // Start at tier 1 (net worth >= 10,000), then add a large liability
    // to push net worth below 10,000
    const bigLiability: Liability = {
      id: "loan_test",
      principalUsd: 45000,
      weeklyPaymentUsd: 50,
      weeksRemaining: 500,
    };
    // cash = 50000, liability principal = 45000 => net worth = 5000, should be tier 0
    const state = withState({
      cashUsd: 50000,
      wealthTier: 1,
      assets: [],
      liabilities: [bigLiability],
    });
    const { state: next } = step(state, makeInput());
    // net worth = 50000 - 45000 - living costs - rent - loan payment ≈ 4850ish => tier 0
    expect(next.wealthTier).toBe(0);
  });

  it("stage2_unlocked flag is set when wealthTier reaches 2", () => {
    // Need enough cash to remain >= 1,000,000 after weekly rent ($90) + living ($60) = $150
    const state = withState({
      cashUsd: 1_001_000,
      assets: [],
      liabilities: [],
      flags: {},
    });
    const { state: next } = step(state, makeInput());
    expect(next.wealthTier).toBe(2);
    expect(next.flags.stage2_unlocked).toBe(true);
  });

  it("stage2_unlocked flag is not set at tier 1", () => {
    const state = withState({
      cashUsd: 50000,
      assets: [],
      liabilities: [],
      flags: {},
    });
    const { state: next } = step(state, makeInput());
    expect(next.wealthTier).toBe(1);
    expect(next.flags.stage2_unlocked).toBeUndefined();
  });
});

describe("launchBusiness()", () => {
  it("fails when wealthTier < 1", () => {
    const state = withState({
      wealthTier: 0,
      flags: { skill_financial_unlocked: true },
      cashUsd: 100000,
    });
    const [newState, error] = launchBusiness(state, "food_stall");
    expect(error).not.toBeNull();
    expect(error).toContain("Tier 1");
    // State unchanged
    expect(newState.assets).toHaveLength(0);
  });

  it("fails when skill_financial_unlocked is false", () => {
    const state = withState({
      wealthTier: 1,
      flags: {},
      cashUsd: 100000,
    });
    const [newState, error] = launchBusiness(state, "food_stall");
    expect(error).not.toBeNull();
    expect(error).toContain("financial skill");
    expect(newState.assets).toHaveLength(0);
  });

  it("fails when businessTypeId is unknown", () => {
    const state = withState({
      wealthTier: 1,
      flags: { skill_financial_unlocked: true },
      cashUsd: 100000,
    });
    const [newState, error] = launchBusiness(state, "unknown_biz");
    expect(error).not.toBeNull();
    expect(error).toContain("Unknown business type");
    expect(newState.assets).toHaveLength(0);
  });

  it("fails when cash < launchCostUsd", () => {
    // food_stall costs $2000
    const state = withState({
      wealthTier: 1,
      flags: { skill_financial_unlocked: true },
      cashUsd: 500,
    });
    const [newState, error] = launchBusiness(state, "food_stall");
    expect(error).not.toBeNull();
    expect(error).toContain("$2000");
    expect(newState.assets).toHaveLength(0);
  });

  it("succeeds at tier 1 with skill unlocked: deducts cash", () => {
    const state = withState({
      wealthTier: 1,
      flags: { skill_financial_unlocked: true },
      cashUsd: 10000,
      week: 5,
    });
    const bizType = CONFIG.businesses.types.find((b) => b.id === "food_stall")!;
    const [newState, error] = launchBusiness(state, "food_stall");
    expect(error).toBeNull();
    expect(newState.cashUsd).toBe(
      Math.round((10000 - bizType.launchCostUsd) * 100) / 100,
    );
  });

  it("succeeds at tier 1 with skill unlocked: adds asset", () => {
    const state = withState({
      wealthTier: 1,
      flags: { skill_financial_unlocked: true },
      cashUsd: 10000,
      week: 5,
    });
    const bizType = CONFIG.businesses.types.find((b) => b.id === "food_stall")!;
    const [newState, error] = launchBusiness(state, "food_stall");
    expect(error).toBeNull();
    expect(newState.assets).toHaveLength(1);
    const asset = newState.assets[0]!;
    expect(asset.id).toBe("biz_food_stall_5");
    expect(asset.type).toBe("food_stall");
    expect(asset.bookValueUsd).toBe(bizType.launchCostUsd);
    expect(asset.weeklyIncomeUsd).toBe(bizType.weeklyIncomeUsd);
  });

  it("succeeds at tier 1 with skill unlocked: appends history tag", () => {
    const state = withState({
      wealthTier: 1,
      flags: { skill_financial_unlocked: true },
      cashUsd: 10000,
      week: 5,
    });
    const [newState, error] = launchBusiness(state, "food_stall");
    expect(error).toBeNull();
    const entry = newState.history.find((h) =>
      h.tags.includes("launched_food_stall"),
    );
    expect(entry).toBeDefined();
    expect(entry!.action).toBe("launched_business_food_stall");
    expect(entry!.week).toBe(5);
  });
});

describe("passive business income in step()", () => {
  it("business weekly income is added to cash each step", () => {
    const bizType = CONFIG.businesses.types.find((b) => b.id === "food_stall")!;
    const asset: Asset = {
      id: "biz_food_stall_1",
      type: "food_stall",
      bookValueUsd: bizType.launchCostUsd,
      weeklyIncomeUsd: bizType.weeklyIncomeUsd,
    };
    const cashBefore = 10000;
    const state = withState({
      cashUsd: cashBefore,
      assets: [asset],
      liabilities: [],
    });
    const rent = CONFIG.cities.kingston.housingTiers[0].weeklyRentUsd;
    const living = CONFIG.cities.kingston.weeklyLivingCostUsd;
    const { state: next } = step(state, makeInput()); // rest-only week, no work/hustle income
    // cash = cashBefore + businessIncome - rent - living
    const expected =
      Math.round((cashBefore + bizType.weeklyIncomeUsd - rent - living) * 100) / 100;
    expect(next.cashUsd).toBe(expected);
  });

  it("multiple businesses each contribute their weekly income", () => {
    const foodStall = CONFIG.businesses.types.find((b) => b.id === "food_stall")!;
    const contentBrand = CONFIG.businesses.types.find(
      (b) => b.id === "content_brand",
    )!;
    const assets: Asset[] = [
      {
        id: "biz_food_stall_1",
        type: "food_stall",
        bookValueUsd: foodStall.launchCostUsd,
        weeklyIncomeUsd: foodStall.weeklyIncomeUsd,
      },
      {
        id: "biz_content_brand_2",
        type: "content_brand",
        bookValueUsd: contentBrand.launchCostUsd,
        weeklyIncomeUsd: contentBrand.weeklyIncomeUsd,
      },
    ];
    const cashBefore = 10000;
    const state = withState({
      cashUsd: cashBefore,
      assets,
      liabilities: [],
    });
    const rent = CONFIG.cities.kingston.housingTiers[0].weeklyRentUsd;
    const living = CONFIG.cities.kingston.weeklyLivingCostUsd;
    const totalBizIncome = foodStall.weeklyIncomeUsd + contentBrand.weeklyIncomeUsd;
    const { state: next } = step(state, makeInput());
    const expected =
      Math.round((cashBefore + totalBizIncome - rent - living) * 100) / 100;
    expect(next.cashUsd).toBe(expected);
  });

  it("asset without weeklyIncomeUsd contributes zero", () => {
    const asset: Asset = {
      id: "property_1",
      type: "real_estate",
      bookValueUsd: 50000,
      // weeklyIncomeUsd intentionally omitted
    };
    const cashBefore = 10000;
    const state = withState({
      cashUsd: cashBefore,
      assets: [asset],
      liabilities: [],
    });
    const rent = CONFIG.cities.kingston.housingTiers[0].weeklyRentUsd;
    const living = CONFIG.cities.kingston.weeklyLivingCostUsd;
    const { state: next } = step(state, makeInput());
    const expected = Math.round((cashBefore - rent - living) * 100) / 100;
    expect(next.cashUsd).toBe(expected);
  });
});
