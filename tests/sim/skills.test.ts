import { describe, expect, it } from "vitest";
import {
  CONFIG,
  effectiveHustleCeiling,
  effectiveLoanApr,
  newGame,
  step,
  type GameState,
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

describe("skills system", () => {
  describe("skill increment", () => {
    it("increments a skill by Math.floor(study) per week", () => {
      const state = withState({ skills: {} });
      const next = step(state, makeInput({ study: 7, skill: "hustle", rest: 93 }));
      expect(next.skills["hustle"]).toBe(7); // Math.floor(7) = 7
    });

    it("adds to an existing skill value", () => {
      const state = withState({ skills: { hustle: 3 } });
      const next = step(state, makeInput({ study: 5, skill: "hustle", rest: 95 }));
      expect(next.skills["hustle"]).toBe(8);
    });

    it("floors fractional study hours", () => {
      const state = withState({ skills: {} });
      // study: 5 (integer) — Math.floor(5) = 5
      const next = step(state, makeInput({ study: 5, skill: "negotiation", rest: 95 }));
      expect(next.skills["negotiation"]).toBe(5);
    });

    it("does not increment any skill when skill string is empty", () => {
      const state = withState({ skills: {} });
      const next = step(state, makeInput({ study: 10, skill: "", rest: 90 }));
      expect(Object.keys(next.skills)).toHaveLength(0);
    });

    it("does not increment any skill when study hours are 0", () => {
      const state = withState({ skills: {} });
      const next = step(state, makeInput({ study: 0, skill: "hustle", rest: 100 }));
      expect(next.skills["hustle"]).toBeUndefined();
    });
  });

  describe("financial skill unlock", () => {
    it("does NOT set skill_financial_unlocked when financial skill is 2", () => {
      // Start with financial = 1, add 1 via study → newSkills.financial = 2 (< 3)
      const state = withState({ skills: { financial: 1 } });
      const next = step(state, makeInput({ study: 1, skill: "financial", rest: 99 }));
      expect(next.skills["financial"]).toBe(2);
      expect(next.flags.skill_financial_unlocked).toBeFalsy();
    });

    it("DOES set skill_financial_unlocked when financial skill reaches 3", () => {
      // Start with financial = 2, add 1 via study → newSkills.financial = 3 (>= 3)
      const state = withState({ skills: { financial: 2 } });
      const next = step(state, makeInput({ study: 1, skill: "financial", rest: 99 }));
      expect(next.skills["financial"]).toBe(3);
      expect(next.flags.skill_financial_unlocked).toBe(true);
    });

    it("sets skill_financial_unlocked when financial skill already exceeds threshold", () => {
      // Already at 5; no study needed — flag is set every step once threshold is met
      const state = withState({ skills: { financial: 5 }, flags: {} });
      const next = step(state, makeInput({ study: 0, skill: "", rest: 100 }));
      expect(next.flags.skill_financial_unlocked).toBe(true);
    });

    it("does not set skill_financial_unlocked when financial skill stays below threshold", () => {
      const state = withState({ skills: { financial: 1 }, flags: {} });
      const next = step(state, makeInput({ study: 0, skill: "", rest: 100 }));
      expect(next.flags.skill_financial_unlocked).toBeFalsy();
    });
  });

  describe("effectiveHustleCeiling", () => {
    it("returns hustleHourlyMaxUsd when hustle skill is 0", () => {
      const state = withState({ skills: {} });
      expect(effectiveHustleCeiling(state)).toBe(CONFIG.cities.kingston.hustleHourlyMaxUsd); // 9
    });

    it("adds 0.5 per skill point above base ceiling", () => {
      const state = withState({ skills: { hustle: 10 } });
      // 9 + 10 * 0.5 = 14
      expect(effectiveHustleCeiling(state)).toBe(14);
    });

    it("caps at hustleAbsoluteCeiling when skill is high", () => {
      // 9 + 32 * 0.5 = 25 — exactly at the absolute ceiling
      const stateAt = withState({ skills: { hustle: 32 } });
      expect(effectiveHustleCeiling(stateAt)).toBe(CONFIG.cities.kingston.hustleAbsoluteCeiling); // 25

      // Beyond the ceiling should still cap
      const stateOver = withState({ skills: { hustle: 50 } });
      expect(effectiveHustleCeiling(stateOver)).toBe(CONFIG.cities.kingston.hustleAbsoluteCeiling); // 25
    });
  });

  describe("effectiveLoanApr", () => {
    it("returns baseAprPct when negotiation skill is 0", () => {
      const state = withState({ skills: {} });
      expect(effectiveLoanApr(state)).toBe(18);
    });

    it("reduces APR by aprReductionPerSkillPoint per skill point", () => {
      // 18 - 20 * 0.25 = 13
      const state = withState({ skills: { negotiation: 20 } });
      expect(effectiveLoanApr(state)).toBe(13);
    });

    it("floors APR at minAprPct", () => {
      // 18 - 56 * 0.25 = 18 - 14 = 4 (exactly at min)
      const stateAt = withState({ skills: { negotiation: 56 } });
      expect(effectiveLoanApr(stateAt)).toBe(4);

      // Beyond the floor should still return minAprPct
      const stateOver = withState({ skills: { negotiation: 100 } });
      expect(effectiveLoanApr(stateOver)).toBe(CONFIG.loans.minAprPct); // 4
    });
  });
});
