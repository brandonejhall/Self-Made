import { describe, expect, it } from "vitest";
import {
  CONFIG,
  newGame,
  step,
  moveHousing,
  type GameState,
  type WeekInput,
} from "../../sim";

// Helper: build a WeekInput with defaults (rest-only, no income)
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

const tier0 = CONFIG.cities.kingston.housingTiers[0]!;
const tier1 = CONFIG.cities.kingston.housingTiers[1]!;
const tier2 = CONFIG.cities.kingston.housingTiers[2]!;
const living = CONFIG.cities.kingston.weeklyLivingCostUsd;

describe("housing system", () => {
  describe("rent deduction in step()", () => {
    it("deducts tier 0 rent ($90) from cash each week", () => {
      const state = withState({ cashUsd: 1000, housingTier: 0 });
      const { state: next } = step(state, makeInput());
      const expected = Math.round((1000 - tier0.weeklyRentUsd - living) * 100) / 100;
      expect(next.cashUsd).toBe(expected);
    });

    it("deducts tier 1 rent ($140) when housingTier is 1", () => {
      const state = withState({ cashUsd: 2000, housingTier: 1 });
      const { state: next } = step(state, makeInput());
      const expected = Math.round((2000 - tier1.weeklyRentUsd - living) * 100) / 100;
      expect(next.cashUsd).toBe(expected);
    });
  });

  describe("moveHousing()", () => {
    it("rejects when cashUsd < cashRequiredUsd", () => {
      const state = withState({ cashUsd: tier1.cashRequiredUsd - 1 });
      const [newState, error] = moveHousing(state, 1);
      expect(error).not.toBeNull();
      expect(error).toContain(`${tier1.cashRequiredUsd}`);
      expect(newState.housingTier).toBe(0);
    });

    it("rejects when cashUsd < depositUsd", () => {
      // With current config cashRequired > deposit, so low cash hits cashRequired first.
      // This test verifies rejection for insufficient funds (which also covers deposit gate).
      const state = withState({ cashUsd: tier1.depositUsd - 1 });
      const [newState, error] = moveHousing(state, 1);
      expect(error).not.toBeNull();
      expect(newState.housingTier).toBe(0);
    });

    it("deducts deposit and updates housingTier on success", () => {
      const startCash = tier1.cashRequiredUsd + 200; // $700 — above cashRequired and deposit
      const state = withState({ cashUsd: startCash });
      const [newState, error] = moveHousing(state, 1);
      expect(error).toBeNull();
      expect(newState.housingTier).toBe(1);
      expect(newState.cashUsd).toBe(
        Math.round((startCash - tier1.depositUsd) * 100) / 100,
      );
    });

    it("rejects an invalid tier (negative)", () => {
      const state = withState({ cashUsd: 50000 });
      const [, error] = moveHousing(state, -1);
      expect(error).not.toBeNull();
      expect(error).toContain("-1");
    });

    it("rejects an invalid tier (out of range)", () => {
      const state = withState({ cashUsd: 50000 });
      const [, error] = moveHousing(state, 10);
      expect(error).not.toBeNull();
      expect(error).toContain("10");
    });

    it("does not mutate the input state", () => {
      const startCash = tier1.cashRequiredUsd + 200;
      const state = withState({ cashUsd: startCash });
      moveHousing(state, 1);
      expect(state.cashUsd).toBe(startCash);
      expect(state.housingTier).toBe(0);
    });
  });

  describe("overdueWeeks counter", () => {
    it("increments overdueWeeks when cash goes below overdueCashFloor after a step", () => {
      // costs for tier 0: $90 rent + $60 living = $150; $10 cash → $10 - $150 = -$140 < 0
      const state = withState({ cashUsd: 10, housingTier: 0, overdueWeeks: 0 });
      const { state: next } = step(state, makeInput());
      expect(next.overdueWeeks).toBe(1);
    });

    it("resets overdueWeeks to 0 when cash is non-negative after a step", () => {
      const state = withState({ cashUsd: 5000, housingTier: 0, overdueWeeks: 1 });
      const { state: next } = step(state, makeInput());
      // $5000 - $90 - $60 = $4850 >= 0
      expect(next.overdueWeeks).toBe(0);
    });
  });

  describe("eviction", () => {
    // Set up a state with 1 overdue week already counted and low enough cash to go
    // negative again. After this step overdueWeeks reaches evictionOverdueCount (2).
    function evictionState(overrides: Partial<GameState> = {}): GameState {
      return withState({
        cashUsd: 10,
        housingTier: 2,       // tier 2 rent $220 so costs $280 — will go negative
        overdueWeeks: 1,
        trust: { halima_yusuf: 50 },
        liabilities: [],
        ...overrides,
      });
    }

    it("resets housingTier to 0 when eviction fires", () => {
      const { state: next } = step(evictionState(), makeInput());
      expect(next.housingTier).toBe(0);
    });

    it("resets overdueWeeks to 0 after eviction", () => {
      const { state: next } = step(evictionState(), makeInput());
      expect(next.overdueWeeks).toBe(0);
    });

    it("appends an 'evicted' tag to history on eviction", () => {
      const { state: next } = step(evictionState(), makeInput());
      const evictedEntry = next.history.find((h) => h.tags.includes("evicted"));
      expect(evictedEntry).toBeDefined();
      expect(evictedEntry!.action).toBe("evicted");
    });

    it("reduces trust['halima_yusuf'] by 20 on eviction", () => {
      const { state: next } = step(evictionState({ trust: { halima_yusuf: 50 } }), makeInput());
      expect(next.trust["halima_yusuf"]).toBe(30);
    });

    it("sets trust['halima_yusuf'] to -20 when no prior trust entry exists", () => {
      const { state: next } = step(evictionState({ trust: {} }), makeInput());
      expect(next.trust["halima_yusuf"]).toBe(-20);
    });

    it("adds a forced repayment liability after eviction", () => {
      const { state: next } = step(evictionState(), makeInput());
      const forced = next.liabilities.find((l) => l.id.startsWith("eviction_repay_"));
      expect(forced).toBeDefined();
      expect(forced!.weeklyPaymentUsd).toBe(
        CONFIG.progression.evictionForcedRepayPerWeek,
      );
      expect(forced!.principalUsd).toBe(tier2.weeklyRentUsd * 2); // 2 weeks back-rent
    });

    it("does not fire eviction when overdueWeeks reaches only 1", () => {
      // First overdue week — no eviction yet
      const state = withState({ cashUsd: 10, housingTier: 2, overdueWeeks: 0 });
      const { state: next } = step(state, makeInput());
      expect(next.overdueWeeks).toBe(1);
      expect(next.housingTier).toBe(2); // not evicted
    });
  });
});
