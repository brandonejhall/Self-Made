// SM-017: business growth stages, reinvestment and failure (GDD 8.4).
import { describe, expect, it } from "vitest";
import {
  CONFIG,
  deserialize,
  launchBusiness,
  newGame,
  reinvestBusiness,
  serialize,
  step,
  type Asset,
  type GameState,
  type WeekInput,
} from "../../sim";
import { nextRandom } from "../../sim/rng";

const REST: WeekInput = { hours: { work: 0, hustle: 0, rest: 100 } };

function foodStall(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "biz_food_stall_0",
    type: "food_stall",
    bookValueUsd: 2000,
    weeklyIncomeUsd: 180,
    kind: "business",
    stage: 1,
    weeksAtStage: 0,
    reinvestedAtStageUsd: 0,
    ...overrides,
  };
}

// step() draws the income roll first, then one failure draw per business.
// Find an rngState whose business draw (second draw) satisfies the predicate.
function rngWithBusinessDraw(pred: (draw: number) => boolean): number {
  for (let s = 1; s < 50_000_000; s++) {
    const [, afterIncome] = nextRandom(s);
    const [draw] = nextRandom(afterIncome);
    if (pred(draw)) return s;
  }
  throw new Error("no rngState found");
}
function businessDraw(rngState: number): number {
  return nextRandom(nextRandom(rngState)[1])[0];
}

const SAFE_RNG = rngWithBusinessDraw((d) => d > 0.5);

function withState(overrides: Partial<GameState>): GameState {
  return { ...newGame(42), rngState: SAFE_RNG, cashUsd: 10000, ...overrides };
}

describe("CONFIG.businesses stages", () => {
  it("holds the 4 GDD 8.4 stages and failure knobs", () => {
    const st = CONFIG.businesses.stages;
    expect(st).toHaveLength(4);
    expect(st.map((s) => s.incomeMult)).toEqual([1, 2, 4, 8]);
    expect(st.map((s) => s.minWeeksToEnter)).toEqual([0, 26, 52, 78]);
    expect(st.map((s) => s.reinvestToEnterUsd)).toEqual([0, 5000, 20000, 60000]);
    expect(st.map((s) => s.weeklyFailureChance)).toEqual([0.003, 0.0015, 0.001, 0.0005]);
    expect(CONFIG.businesses.burnoutFailureMult).toBe(2);
    expect(CONFIG.businesses.failureReputationPenalty).toBe(5);
  });
});

describe("launchBusiness growth fields", () => {
  it("creates a stage 1 business asset", () => {
    const s = withState({ wealthTier: 1, flags: { skill_financial_unlocked: true }, week: 3 });
    const [next, err] = launchBusiness(s, "food_stall");
    expect(err).toBeNull();
    expect(next.assets[0]).toMatchObject({
      kind: "business",
      stage: 1,
      weeksAtStage: 0,
      reinvestedAtStageUsd: 0,
    });
  });
});

describe("reinvestBusiness", () => {
  it("deducts cash and adds to reinvestedAtStageUsd and bookValueUsd", () => {
    const s = withState({ assets: [foodStall({ reinvestedAtStageUsd: 100 })] });
    const [next, err] = reinvestBusiness(s, "biz_food_stall_0", 1500);
    expect(err).toBeNull();
    expect(next.cashUsd).toBe(8500);
    expect(next.assets[0]!.reinvestedAtStageUsd).toBe(1600);
    expect(next.assets[0]!.bookValueUsd).toBe(3500);
    expect(next.history.at(-1)!.tags).toEqual(["reinvested_food_stall"]);
    // input not mutated
    expect(s.cashUsd).toBe(10000);
    expect(s.assets[0]!.reinvestedAtStageUsd).toBe(100);
  });

  it("errors on unknown asset id", () => {
    const s = withState({ assets: [foodStall()] });
    const [next, err] = reinvestBusiness(s, "nope", 100);
    expect(err).not.toBeNull();
    expect(next).toBe(s);
  });

  it("errors on a non-business asset", () => {
    const s = withState({ assets: [{ id: "plot", type: "land", bookValueUsd: 5000 }] });
    const [next, err] = reinvestBusiness(s, "plot", 100);
    expect(err).not.toBeNull();
    expect(next).toBe(s);
  });

  it.each([0, -50])("errors on amountUsd %s", (amt) => {
    const s = withState({ assets: [foodStall()] });
    const [next, err] = reinvestBusiness(s, "biz_food_stall_0", amt);
    expect(err).not.toBeNull();
    expect(next).toBe(s);
  });

  it("errors when cash is below the amount", () => {
    const s = withState({ cashUsd: 999.99, assets: [foodStall()] });
    const [next, err] = reinvestBusiness(s, "biz_food_stall_0", 1000);
    expect(err).not.toBeNull();
    expect(next).toBe(s);
  });

  it("errors on a stage 4 business", () => {
    const s = withState({ assets: [foodStall({ stage: 4, weeklyIncomeUsd: 1440 })] });
    const [next, err] = reinvestBusiness(s, "biz_food_stall_0", 100);
    expect(err).not.toBeNull();
    expect(next).toBe(s);
  });
});

describe("stage growth in step()", () => {
  it("food stall with $5,000 reinvested advances on the step where weeksAtStage reaches 26", () => {
    let s = withState({ assets: [foodStall()] });
    s = reinvestBusiness(s, "biz_food_stall_0", 5000)[0];
    for (let i = 0; i < 25; i++) {
      s = { ...step(s, REST).state, energy: 100, rngState: SAFE_RNG };
      expect(s.assets[0]!.stage).toBe(1);
    }
    expect(s.assets[0]!.weeksAtStage).toBe(25);
    const next = step(s, REST).state;
    const biz = next.assets[0]!;
    expect(biz.stage).toBe(2);
    expect(biz.weeksAtStage).toBe(0);
    expect(biz.reinvestedAtStageUsd).toBe(0);
    expect(biz.weeklyIncomeUsd).toBe(360);
    expect(biz.bookValueUsd).toBe(7000); // growth never raises book value
    expect(next.history.at(-1)!.tags).toContain("grew_food_stall_stage2");
  });

  it("food stall at 26 weeks with $4,999.99 reinvested stays at stage 1", () => {
    const s = withState({ assets: [foodStall({ weeksAtStage: 25, reinvestedAtStageUsd: 4999.99 })] });
    const biz = step(s, REST).state.assets[0]!;
    expect(biz.weeksAtStage).toBe(26);
    expect(biz.stage).toBe(1);
    expect(biz.weeklyIncomeUsd).toBe(180);
  });

  it("advances at most 1 stage per step", () => {
    const s = withState({
      assets: [foodStall({ weeksAtStage: 500, reinvestedAtStageUsd: 1_000_000 })],
    });
    const a = step(s, REST).state;
    expect(a.assets[0]!.stage).toBe(2);
    // next stage needs 52 fresh weeks at stage 2, so another step does not advance
    const b = step({ ...a, rngState: SAFE_RNG }, REST).state;
    expect(b.assets[0]!.stage).toBe(2);
  });

  it("stage 4 income is base x 8 for every type", () => {
    const expected: Record<string, number> = {
      food_stall: 1440, delivery_service: 2080, short_term_rental: 1760, content_brand: 640,
    };
    for (const t of CONFIG.businesses.types) {
      const s = withState({
        assets: [foodStall({ id: "b", type: t.id, stage: 3, weeksAtStage: 77, reinvestedAtStageUsd: 60000 })],
      });
      const biz = step(s, REST).state.assets[0]!;
      expect(biz.stage).toBe(4);
      expect(biz.weeklyIncomeUsd).toBe(expected[t.id]);
    }
  });
});

describe("business failure", () => {
  it("a draw below 0.003 removes a stage 1 business, tags it and costs 5 reputation", () => {
    const rng = rngWithBusinessDraw((d) => d < 0.003);
    expect(businessDraw(rng)).toBeLessThan(0.003);
    const s = withState({ rngState: rng, reputation: 30, assets: [foodStall()] });
    const next = step(s, REST).state;
    expect(next.assets).toHaveLength(0);
    expect(next.history.some((h) => h.tags.includes("lost_business_food_stall"))).toBe(true);
    expect(next.reputation).toBe(25);
  });

  it("failure reputation penalty clamps at 0", () => {
    const rng = rngWithBusinessDraw((d) => d < 0.003);
    const s = withState({ rngState: rng, reputation: 3, assets: [foodStall()] });
    expect(step(s, REST).state.reputation).toBe(0);
  });

  it("energy < 20 doubles the chance: a 0.005 draw fails at low energy but not at 20", () => {
    const rng = rngWithBusinessDraw((d) => d >= 0.0049 && d < 0.0051);
    expect(businessDraw(rng)).toBeGreaterThanOrEqual(0.003);
    expect(businessDraw(rng)).toBeLessThan(0.006);

    const low = step(withState({ rngState: rng, energy: 19, assets: [foodStall()] }), REST).state;
    expect(low.assets).toHaveLength(0);
    expect(low.history.some((h) => h.tags.includes("lost_business_food_stall"))).toBe(true);

    const ok = step(withState({ rngState: rng, energy: 20, assets: [foodStall()] }), REST).state;
    expect(ok.assets).toHaveLength(1);
  });

  it("draws RNG only when a business is owned", () => {
    const base = withState({ assets: [] });
    const without = step(base, REST).state.rngState;
    const withBiz = step({ ...base, assets: [foodStall()] }, REST).state.rngState;
    expect(without).toBe(nextRandom(base.rngState)[1]);
    expect(withBiz).toBe(nextRandom(nextRandom(base.rngState)[1])[1]);
    // non-business assets do not draw
    const plot = step({ ...base, assets: [{ id: "p", type: "land", bookValueUsd: 1 }] }, REST).state;
    expect(plot.rngState).toBe(without);
  });

  it("is deterministic for the same state", () => {
    const s = withState({ assets: [foodStall()] });
    expect(serialize(step(s, REST).state)).toBe(serialize(step(s, REST).state));
  });
});

describe("serialize / deserialize", () => {
  it("round-trips a stage 3 business with partial reinvestment", () => {
    const s = withState({
      assets: [foodStall({ stage: 3, weeksAtStage: 40, reinvestedAtStageUsd: 12345.67, bookValueUsd: 39345.67, weeklyIncomeUsd: 720 })],
    });
    const back = deserialize(serialize(s));
    expect(back).toEqual(s);
    expect(back.assets[0]).toMatchObject({ kind: "business", stage: 3, weeksAtStage: 40, reinvestedAtStageUsd: 12345.67 });
  });
});
