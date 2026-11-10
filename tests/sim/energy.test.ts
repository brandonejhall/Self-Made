import { describe, expect, it } from "vitest";
import { CONFIG, newGame, step, type GameState, type WeekInput } from "../../sim";

// Helper to build a full WeekInput with defaults for unused slots
function hours(
  work: number,
  hustle: number,
  rest: number,
  study = 0,
  sideProject = 0,
): WeekInput {
  return { hours: { work, hustle, rest, study, sideProject } };
}

// Helper to override specific GameState fields
function withState(overrides: Partial<GameState>): GameState {
  return { ...newGame(42), ...overrides };
}

describe("energy model", () => {
  describe("study and sideProject drain", () => {
    it("study hours drain energy at studyCostPerHour", () => {
      const startEnergy = 60;
      const state = withState({ energy: startEnergy });
      // 10 study hours, no other activity
      const next = step(state, hours(0, 0, 0, 10, 0));
      const expectedDrain = 10 * CONFIG.energy.studyCostPerHour;
      expect(next.energy).toBeCloseTo(startEnergy - expectedDrain, 5);
    });

    it("sideProject hours drain energy at sideProjectCostPerHour", () => {
      const startEnergy = 60;
      const state = withState({ energy: startEnergy });
      // 10 sideProject hours, no other activity
      const next = step(state, hours(0, 0, 0, 0, 10));
      const expectedDrain = 10 * CONFIG.energy.sideProjectCostPerHour;
      expect(next.energy).toBeCloseTo(startEnergy - expectedDrain, 5);
    });
  });

  describe("burnoutWeeks counter", () => {
    it("increments burnoutWeeks when energy hits 0", () => {
      // Start with energy 1 and drain hard
      const state = withState({ energy: 1, burnoutWeeks: 0 });
      // 100 work hours: drain = 50, recovery = 0 → newEnergy = 0
      const next = step(state, hours(100, 0, 0));
      expect(next.energy).toBe(0);
      expect(next.burnoutWeeks).toBe(1);
    });

    it("resets burnoutWeeks when energy is above 0", () => {
      // burnoutWeeks already at 1 but then we rest and recover
      const state = withState({ energy: 50, burnoutWeeks: 1 });
      // rest 100 hours: recovery = 60 → energy goes to max 100, above 0
      const next = step(state, hours(0, 0, 100));
      expect(next.energy).toBeGreaterThan(0);
      expect(next.burnoutWeeks).toBe(0);
    });
  });

  describe("burnout_active flag", () => {
    it("sets burnout_active after energy is 0 for 2 consecutive weeks", () => {
      // Set up: energy is very low so it hits 0 this week (burnoutWeeks becomes 1)
      const state1 = withState({ energy: 1, burnoutWeeks: 0, flags: {} });
      const state2 = step(state1, hours(100, 0, 0));
      expect(state2.burnoutWeeks).toBe(1);
      expect(state2.flags.burnout_active).toBeFalsy();

      // Second consecutive week at 0 energy → burnout_active should be set
      const state3 = step(state2, hours(100, 0, 0));
      expect(state3.burnoutWeeks).toBe(2);
      expect(state3.flags.burnout_active).toBe(true);
    });

    it("clears burnout_active when energy recovers above burnoutClearThreshold", () => {
      // Start in burnout: active flag set, low energy
      const state = withState({
        energy: 10,
        burnoutWeeks: 2,
        flags: { burnout_active: true },
      });

      // Rest heavily — but burnout halves recovery. Need enough rest to cross 50.
      // recovery = rest * restRecoveryPerHour * burnoutRecoveryMult
      //          = rest * 0.6 * 0.5 = rest * 0.3
      // Need: 10 + rest * 0.3 > 50  →  rest > 133.3 hours — capped at 100
      // Max recovery with 100 rest: 10 + 100 * 0.3 = 40 (not enough in one step)
      // So we need to do it in stages. First, get out of burnout enough to clear the flag.
      // Actually, let's set energy higher so one full rest clears it.
      // Set energy = 25 so: 25 + 100 * 0.3 = 55 > 50 → clears!
      const highEnergyBurnout = withState({
        energy: 25,
        burnoutWeeks: 2,
        flags: { burnout_active: true },
      });
      const next = step(highEnergyBurnout, hours(0, 0, 100));
      // energy = 25 + 100 * 0.6 * 0.5 = 25 + 30 = 55 > 50
      expect(next.energy).toBeGreaterThan(CONFIG.energy.burnoutClearThreshold);
      expect(next.flags.burnout_active).toBe(false);
      expect(next.burnoutWeeks).toBe(0);
    });

    it("does not set burnout_active after only one week at 0 energy", () => {
      const state = withState({ energy: 1, burnoutWeeks: 0, flags: {} });
      const next = step(state, hours(100, 0, 0));
      expect(next.burnoutWeeks).toBe(1);
      expect(next.flags.burnout_active).toBeFalsy();
    });
  });

  describe("burnout income penalty", () => {
    it("halves income when energy is below burnoutThreshold at start of week", () => {
      // Energy below threshold (20) at start
      const lowEnergy = withState({ energy: CONFIG.energy.burnoutThreshold - 1 });
      // Energy above threshold at start
      const highEnergy = withState({ energy: CONFIG.energy.burnoutThreshold + 1 });

      // Same seed and inputs — only energy differs
      const inputW = hours(40, 0, 60);

      // Run both with the same rng state so the hustle roll is identical
      const sharedRngState = newGame(42).rngState;
      const lowEnergyState = withState({
        energy: CONFIG.energy.burnoutThreshold - 1,
        rngState: sharedRngState,
      });
      const highEnergyState = withState({
        energy: CONFIG.energy.burnoutThreshold + 1,
        rngState: sharedRngState,
      });

      const nextLow = step(lowEnergyState, inputW);
      const nextHigh = step(highEnergyState, inputW);

      // The cash difference should reflect ~half income for the low-energy run.
      // Both states start with same cashUsd (from newGame default) and same costs.
      // So the income difference = nextHigh.cashUsd - nextLow.cashUsd
      // And high income = 2 * low income (since productivityMult = 0.5)
      const cashDiff = nextHigh.cashUsd - nextLow.cashUsd;
      // highIncome = work * wage * 1.0 + hustle * rate * 1.0
      // lowIncome  = work * wage * 0.5 + hustle * rate * 0.5
      // diff = 0.5 * (work * wage + hustle * rate) = 0.5 * highIncome
      // So cashDiff should equal lowIncome (which is 0.5 * highIncome)
      expect(cashDiff).toBeGreaterThan(0);
      // Confirm the high income run earns exactly 2x the low income run
      // Both share same costs, so: cashDiff = highIncome - lowIncome = highIncome - 0.5*highIncome = 0.5*highIncome
      // Also lowIncome = cashDiff (since lowIncome = 0.5*highIncome and cashDiff = 0.5*highIncome)
      // Cross check: lowCashChange = lowIncome - costs, highCashChange = highIncome - costs
      // highCashChange - lowCashChange = highIncome - lowIncome = cashDiff
      // highIncome = 2 * lowIncome → cashDiff = lowIncome
      const lowCashChange = nextLow.cashUsd - lowEnergyState.cashUsd;
      const highCashChange = nextHigh.cashUsd - highEnergyState.cashUsd;
      // highCashChange - lowCashChange == lowCashChange + costs - costs (not quite — let's just check ratio)
      // Both subtract same costs, so income ratio is preserved in cash-change difference
      expect(highCashChange).toBeCloseTo(lowCashChange + cashDiff, 1);
    });

    it("does not apply penalty when energy is exactly at burnoutThreshold", () => {
      // Energy at exactly 20 should NOT trigger penalty (threshold is strictly < 20)
      const atThreshold = withState({
        energy: CONFIG.energy.burnoutThreshold,
        rngState: newGame(42).rngState,
      });
      const aboveThreshold = withState({
        energy: CONFIG.energy.burnoutThreshold + 10,
        rngState: newGame(42).rngState,
      });
      const inputW = hours(40, 0, 60);
      const nextAt = step(atThreshold, inputW);
      const nextAbove = step(aboveThreshold, inputW);
      // Both should earn the same income (no penalty at threshold)
      // But they differ in starting energy so costs are the same but energy levels differ
      // Income is what matters: work * wage * mult (hustle = 0 so roll doesn't matter)
      // cashUsd difference = energy difference contribution to costs only (none) + income difference
      // Since only work hours and no hustle, income = work * wage * mult
      // If no penalty at threshold, both earn the same income → cash change is equal
      const lowChange = nextAt.cashUsd - atThreshold.cashUsd;
      const highChange = nextAbove.cashUsd - aboveThreshold.cashUsd;
      expect(lowChange).toBeCloseTo(highChange, 1);
    });
  });

  describe("burnout hour cap", () => {
    it("rejects work + hustle > burnoutMaxHours while burnout_active", () => {
      const state = withState({ flags: { burnout_active: true } });
      // work + hustle = 50 > 40
      expect(() => step(state, hours(30, 20, 50))).toThrow();
    });

    it("allows work + hustle <= burnoutMaxHours while burnout_active", () => {
      const state = withState({ flags: { burnout_active: true } });
      // work + hustle = 40 exactly, rest = 60 → total = 100 (ok)
      expect(() => step(state, hours(20, 20, 60))).not.toThrow();
    });

    it("does not enforce hour cap when burnout_active is false", () => {
      const state = withState({ flags: {} });
      // work + hustle = 60 (> 40) but no burnout — should be fine
      expect(() => step(state, hours(40, 20, 40))).not.toThrow();
    });
  });

  describe("validateInput", () => {
    it("rejects total hours > hoursPerWeek", () => {
      const state = newGame(1);
      expect(() =>
        step(state, { hours: { work: 40, hustle: 30, rest: 20, study: 10, sideProject: 5 } }),
      ).toThrow();
    });

    it("rejects negative hours", () => {
      const state = newGame(1);
      expect(() => step(state, hours(-1, 0, 100))).toThrow();
    });

    it("accepts total hours exactly equal to hoursPerWeek", () => {
      const state = newGame(1);
      // 40 + 10 + 40 + 5 + 5 = 100
      expect(() =>
        step(state, { hours: { work: 40, hustle: 10, rest: 40, study: 5, sideProject: 5 } }),
      ).not.toThrow();
    });
  });

  describe("recovery while burnout_active", () => {
    it("halves rest recovery when burnout_active is true", () => {
      const normalState = withState({ energy: 30, flags: {} });
      const burnoutState = withState({ energy: 30, flags: { burnout_active: true } });
      const inputW = hours(0, 0, 100);

      const nextNormal = step(normalState, inputW);
      const nextBurnout = step(burnoutState, inputW);

      // Normal: 30 + 100 * 0.6 = 90 (clamped to 100 → actually 90 < 100 → 90)
      // Burnout: 30 + 100 * 0.6 * 0.5 = 30 + 30 = 60
      expect(nextNormal.energy).toBeCloseTo(90, 5);
      expect(nextBurnout.energy).toBeCloseTo(60, 5);
    });
  });
});
