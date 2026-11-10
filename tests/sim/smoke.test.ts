import { describe, expect, it } from "vitest";
import { deserialize, newGame, serialize, step, type Asset, type Liability, type WeekInput } from "../../sim";

// work + hustle = 40 (at the burnoutMaxHours cap) so this fixture stays valid even if burnout_active triggers
const week: WeekInput = { hours: { work: 30, hustle: 10, rest: 60, study: 0, sideProject: 0, skill: "" } };

describe("sim skeleton", () => {
  it("starts at age 21 with $2,000", () => {
    const s = newGame(42);
    expect(s.age).toBe(21);
    expect(s.cashUsd).toBe(2000);
  });

  it("is deterministic for the same seed and inputs", () => {
    let a = newGame(7);
    let b = newGame(7);
    for (let i = 0; i < 100; i++) {
      a = step(a, week).state;
      b = step(b, week).state;
    }
    expect(a).toEqual(b);
  });

  it("does not mutate the input state", () => {
    const s = newGame(1);
    const copy = structuredClone(s);
    step(s, week);
    expect(s).toEqual(copy);
  });

  it("ages the player one year every 52 weeks", () => {
    let s = newGame(3);
    for (let i = 0; i < 52; i++) s = step(s, week).state;
    expect(s.age).toBe(22);
  });

  it("rejects more than 100 hours", () => {
    expect(() =>
      step(newGame(1), { hours: { work: 60, hustle: 20, rest: 20, study: 1, sideProject: 0, skill: "" } }),
    ).toThrow();
  });

  it("round-trips through serialize", () => {
    const { state: s } = step(newGame(9), week);
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it("round-trips a state with all new fields populated", () => {
    const asset: Asset = {
      id: "asset-001",
      type: "rental_property",
      bookValueUsd: 50000,
      weeklyIncomeUsd: 150,
    };
    const liability: Liability = {
      id: "loan-001",
      principalUsd: 20000,
      weeklyPaymentUsd: 100,
      weeksRemaining: 200,
    };
    const base = newGame(99);
    const enriched = {
      ...base,
      skills: { hustle: 2, networking: 1 },
      trust: { mentor_daryl: 50 },
      assets: [asset],
      liabilities: [liability],
      firedEvents: ["evt_first_paycheck", "evt_met_mentor"],
      housingTier: 1,
      overdueWeeks: 0,
      burnoutWeeks: 0,
      wealthTier: 0,
      activeJobId: "job_warehouse",
      underHoursWeeks: 0,
    };
    expect(deserialize(serialize(enriched))).toEqual(enriched);
  });
});
