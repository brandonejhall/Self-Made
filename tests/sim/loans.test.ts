import { describe, expect, it } from "vitest";
import {
  CONFIG,
  newGame,
  netWorthUsd,
  step,
  takeLoan,
  type GameState,
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

describe("loan system", () => {
  describe("takeLoan eligibility", () => {
    it("succeeds when reputation >= minReputation at tier 0", () => {
      const state = withState({ reputation: CONFIG.loans.minReputation });
      const [newState, error] = takeLoan(state, 500, 26);
      expect(error).toBeNull();
      expect(newState.liabilities).toHaveLength(1);
      expect(newState.liabilities[0]!.principalUsd).toBe(500);
    });

    it("fails when reputation < minReputation and cash > emergencyMinCash", () => {
      const state = withState({
        reputation: CONFIG.loans.minReputation - 1,
        cashUsd: 100,
      });
      const [newState, error] = takeLoan(state, 500, 26);
      expect(error).not.toBeNull();
      expect(error).toContain("Reputation");
      // State should be unchanged
      expect(newState.liabilities).toHaveLength(0);
    });

    it("succeeds despite low reputation when cash <= emergencyMinCash", () => {
      const state = withState({
        reputation: 5, // below minReputation
        cashUsd: CONFIG.loans.emergencyMinCash, // exactly at threshold
      });
      const [newState, error] = takeLoan(state, 500, 26);
      expect(error).toBeNull();
      expect(newState.liabilities).toHaveLength(1);
    });

    it("emergency override activates when cash is below emergencyMinCash", () => {
      const state = withState({
        reputation: 0,
        cashUsd: CONFIG.loans.emergencyMinCash - 1,
      });
      const [newState, error] = takeLoan(state, 500, 26);
      expect(error).toBeNull();
      expect(newState.liabilities).toHaveLength(1);
    });

    it("cannot take a second loan at tier 0 (maxSimultaneous = 1)", () => {
      const loan: Liability = {
        id: "loan_0_500",
        principalUsd: 500,
        weeklyPaymentUsd: 20,
        weeksRemaining: 10,
      };
      const state = withState({
        reputation: 50,
        wealthTier: 0,
        liabilities: [loan],
      });
      const [newState, error] = takeLoan(state, 1000, 26);
      expect(error).not.toBeNull();
      expect(error).toContain("simultaneous");
      expect(newState.liabilities).toHaveLength(1); // unchanged
    });

    it("allows two simultaneous loans at tier 1", () => {
      const loan: Liability = {
        id: "loan_0_500",
        principalUsd: 500,
        weeklyPaymentUsd: 20,
        weeksRemaining: 10,
      };
      const state = withState({
        reputation: 50,
        wealthTier: 1,
        liabilities: [loan],
      });
      const [newState, error] = takeLoan(state, 1000, 26);
      expect(error).toBeNull();
      expect(newState.liabilities).toHaveLength(2);
    });
  });

  describe("takeLoan state mutations", () => {
    it("adds the loan amount to cashUsd", () => {
      const state = withState({ reputation: 50, cashUsd: 1000 });
      const [newState] = takeLoan(state, 500, 26);
      expect(newState.cashUsd).toBe(1500);
    });

    it("adds a Liability with correct fields", () => {
      const state = withState({ reputation: 50, cashUsd: 1000, week: 5 });
      const [newState] = takeLoan(state, 1000, 52);
      const liability = newState.liabilities[0]!;
      expect(liability.id).toBe("loan_5_1000");
      expect(liability.principalUsd).toBe(1000);
      expect(liability.weeksRemaining).toBe(52);
      // weekly payment should be a positive number
      expect(liability.weeklyPaymentUsd).toBeGreaterThan(0);
    });

    it("computes weekly payment using amortization formula", () => {
      // With APR 18% (no negotiation), weekly rate = 18/52/100
      // principal = 1000, termWeeks = 52
      const apr = 18;
      const weeklyRate = apr / 52 / 100;
      const termWeeks = 52;
      const amount = 1000;
      const expected =
        Math.round(
          ((amount * weeklyRate) / (1 - Math.pow(1 + weeklyRate, -termWeeks))) * 100,
        ) / 100;

      const state = withState({ reputation: 50, skills: {} }); // no negotiation
      const [newState] = takeLoan(state, amount, termWeeks);
      expect(newState.liabilities[0]!.weeklyPaymentUsd).toBe(expected);
    });

    it("appends took_loan tag to history", () => {
      const state = withState({ reputation: 50 });
      const [newState] = takeLoan(state, 500, 26);
      const entry = newState.history.find((h) => h.tags.includes("took_loan"));
      expect(entry).toBeDefined();
      expect(entry!.tags).toContain("took_loan");
    });
  });

  describe("step() loan repayment", () => {
    it("deducts weekly payment from cash in step()", () => {
      const loan: Liability = {
        id: "loan_0_1000",
        principalUsd: 1000,
        weeklyPaymentUsd: 25,
        weeksRemaining: 5,
      };
      const state = withState({
        reputation: 50,
        cashUsd: 2000,
        liabilities: [loan],
      });
      const before = state.cashUsd;
      const rent = CONFIG.cities.kingston.housingTiers[0].weeklyRentUsd;
      const living = CONFIG.cities.kingston.weeklyLivingCostUsd;
      const { state: next } = step(state, makeInput());
      // cash = before - rent - living - loanPayment (no income, rest-only week)
      const expectedCash = Math.round((before - rent - living - 25) * 100) / 100;
      expect(next.cashUsd).toBe(expectedCash);
    });

    it("decrements weeksRemaining by 1 each step", () => {
      const loan: Liability = {
        id: "loan_0_1000",
        principalUsd: 1000,
        weeklyPaymentUsd: 25,
        weeksRemaining: 5,
      };
      const state = withState({ reputation: 50, cashUsd: 5000, liabilities: [loan] });
      const { state: next } = step(state, makeInput());
      expect(next.liabilities[0]!.weeksRemaining).toBe(4);
    });

    it("removes liability from state.liabilities when weeksRemaining hits 0", () => {
      const loan: Liability = {
        id: "loan_0_1000",
        principalUsd: 1000,
        weeklyPaymentUsd: 25,
        weeksRemaining: 1, // last payment this step
      };
      const state = withState({ reputation: 50, cashUsd: 5000, liabilities: [loan] });
      const { state: next } = step(state, makeInput());
      expect(next.liabilities).toHaveLength(0);
    });

    it("retains loans that still have payments remaining", () => {
      const loans: Liability[] = [
        { id: "loan_a", principalUsd: 500, weeklyPaymentUsd: 15, weeksRemaining: 1 },
        { id: "loan_b", principalUsd: 1000, weeklyPaymentUsd: 25, weeksRemaining: 5 },
      ];
      const state = withState({ reputation: 50, cashUsd: 5000, liabilities: loans, wealthTier: 1 });
      const { state: next } = step(state, makeInput());
      // loan_a should be gone (weeksRemaining was 1 → 0), loan_b should remain
      expect(next.liabilities).toHaveLength(1);
      expect(next.liabilities[0]!.id).toBe("loan_b");
      expect(next.liabilities[0]!.weeksRemaining).toBe(4);
    });
  });

  describe("netWorthUsd with loans", () => {
    it("subtracts liability principal from net worth", () => {
      const loan: Liability = {
        id: "loan_0_1000",
        principalUsd: 1000,
        weeklyPaymentUsd: 25,
        weeksRemaining: 10,
      };
      const state = withState({ cashUsd: 3000, assets: [], liabilities: [loan] });
      // net worth = 3000 + 0 - 1000 = 2000
      expect(netWorthUsd(state)).toBe(2000);
    });

    it("returns cash alone when no assets or liabilities", () => {
      const state = withState({ cashUsd: 500, assets: [], liabilities: [] });
      expect(netWorthUsd(state)).toBe(500);
    });
  });
});
