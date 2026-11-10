// SM-016: rental property system (GDD 9.1, 7.4, 14).
import { describe, expect, it } from "vitest";
import {
  CONFIG,
  buyProperty,
  deserialize,
  mortgagePaymentUsd,
  netWorthUsd,
  newGame,
  sellProperty,
  serialize,
  step,
  takeLoan,
  type GameState,
  type WeekInput,
} from "../../sim";
import { nextRandom } from "../../sim/rng";

const round2 = (n: number) => Math.round(n * 100) / 100;

// Zero work and hustle hours: work/hustle income is exactly 0 regardless of the hustle roll.
const IDLE: WeekInput = { hours: { work: 0, hustle: 0, rest: 100 } };

// Draws per step with no events passed: 1 hustle roll, then 1 draw per owned property.
function propertyDraws(rngState: number, steps: number, properties: number): number[][] {
  const out: number[][] = [];
  let s = rngState;
  for (let i = 0; i < steps; i++) {
    s = nextRandom(s)[1]; // hustle roll
    const row: number[] = [];
    for (let p = 0; p < properties; p++) {
      const [v, ns] = nextRandom(s);
      row.push(v);
      s = ns;
    }
    out.push(row);
  }
  return out;
}

// First rngState whose property draws match the predicate.
function findRng(steps: number, properties: number, ok: (draws: number[][]) => boolean): number {
  for (let s = 1; s < 10_000_000; s++) {
    if (ok(propertyDraws(s, steps, properties))) return s;
  }
  throw new Error("no rngState found");
}

const VAC = CONFIG.property.vacancyChancePerWeek;
const noVacancy = (steps: number, properties = 1) =>
  findRng(steps, properties, (d) => d.every((row) => row.every((v) => v >= VAC)));

function tier1(overrides: Partial<GameState> = {}): GameState {
  return { ...newGame(42), wealthTier: 1, cashUsd: 50_000, ...overrides };
}

function buyStudio(state: GameState, down = 6000, term = 1040): GameState {
  const [s, err] = buyProperty(state, "kgn_studio", down, term);
  expect(err).toBeNull();
  return s;
}

function run(state: GameState, steps: number): GameState {
  let s = state;
  for (let i = 0; i < steps; i++) s = step(s, IDLE).state;
  return s;
}

const property = (s: GameState) => s.assets.find((a) => a.kind === "property")!;
const mortgage = (s: GameState) => s.liabilities.find((l) => l.kind === "mortgage");

describe("SM-016 config", () => {
  it("CONFIG.property holds every GDD section 14 key with GDD values", () => {
    const p = CONFIG.property;
    expect(p.maxOwned).toBe(3);
    expect(p.minDownPaymentPct).toBe(0.2);
    expect(p.closingCostPct).toBe(0.03);
    expect(p.mortgageAprPct).toBe(9);
    expect([...p.mortgageTermWeeksOptions]).toEqual([520, 1040]);
    expect(p.maintenancePctPerYear).toBe(0.01);
    expect(p.vacancyChancePerWeek).toBe(0.015);
    expect(p.vacancyWeeks).toBe(6);
    expect(p.appreciationPctPerYear).toBe(0.04);
    expect(p.sellingCostPct).toBe(0.05);
  });

  it("CONFIG.property.types holds the 3 Kingston types", () => {
    expect(CONFIG.property.types.map((t) => ({ ...t }))).toEqual([
      { id: "kgn_studio", priceUsd: 30000, weeklyRentUsd: 60 },
      { id: "kgn_two_bed", priceUsd: 65000, weeklyRentUsd: 120 },
      { id: "kgn_house", priceUsd: 150000, weeklyRentUsd: 260 },
    ]);
  });
});

describe("buyProperty validation", () => {
  const cases: Array<[string, GameState, string, number, number]> = [
    ["wealthTier < 1", tier1({ wealthTier: 0 }), "kgn_studio", 6000, 1040],
    ["unknown type id", tier1(), "kgn_castle", 6000, 1040],
    ["down payment below 20%", tier1(), "kgn_studio", 5999.99, 1040],
    ["down payment above price", tier1(), "kgn_studio", 30000.01, 1040],
    ["term not allowed while a mortgage is needed", tier1(), "kgn_studio", 6000, 780],
    ["cash below down payment plus closing", tier1({ cashUsd: 6899.99 }), "kgn_studio", 6000, 1040],
  ];
  for (const [name, state, typeId, down, term] of cases) {
    it(`rejects: ${name}`, () => {
      const [s, err] = buyProperty(state, typeId, down, term);
      expect(err).not.toBeNull();
      expect(s).toBe(state);
    });
  }

  it("rejects a 4th property", () => {
    let s = tier1({ cashUsd: 100_000 });
    for (let i = 0; i < 3; i++) s = buyStudio(s);
    const [after, err] = buyProperty(s, "kgn_studio", 6000, 1040);
    expect(err).not.toBeNull();
    expect(after).toBe(s);
  });

  it("ignores the term when the down payment covers the full price", () => {
    const [, err] = buyProperty(tier1(), "kgn_studio", 30000, 0);
    expect(err).toBeNull();
  });

  it("does not mutate the input state", () => {
    const state = tier1();
    const snapshot = serialize(state);
    buyProperty(state, "kgn_studio", 6000, 1040);
    expect(serialize(state)).toBe(snapshot);
  });
});

describe("buyProperty success", () => {
  it("kgn_studio, $6,000 down, 1040 weeks", () => {
    const before = tier1();
    const s = buyStudio(before);
    expect(s.cashUsd).toBe(round2(before.cashUsd - 6900));

    expect(s.assets).toHaveLength(1);
    const a = s.assets[0]!;
    expect(a.kind).toBe("property");
    expect(a.type).toBe("kgn_studio");
    expect(a.bookValueUsd).toBe(30000);
    expect(a.occupied).toBe(true);
    expect(a.weeklyIncomeUsd).toBeUndefined();

    expect(s.liabilities).toHaveLength(1);
    const m = s.liabilities[0]!;
    expect(m.kind).toBe("mortgage");
    expect(m.principalUsd).toBe(24000);
    expect(m.propertyId).toBe(a.id);
    const r = 9 / 52 / 100;
    const expected = Math.round(((24000 * r) / (1 - Math.pow(1 + r, -1040))) * 100) / 100;
    expect(m.weeklyPaymentUsd).toBe(expected);
    expect(mortgagePaymentUsd(24000, 9, 1040)).toBe(expected);
    expect(m.weeksRemaining).toBe(1040);

    expect(s.history.at(-1)!.tags).toContain("bought_kgn_studio");
  });

  it("$30,000 down on kgn_studio creates no liability", () => {
    const s = buyStudio(tier1(), 30000);
    expect(s.liabilities).toHaveLength(0);
    expect(s.cashUsd).toBe(50000 - 30900);
  });

  it("gives each property a unique id", () => {
    let s = tier1({ cashUsd: 100_000 });
    for (let i = 0; i < 3; i++) s = buyStudio(s);
    expect(new Set(s.assets.map((a) => a.id)).size).toBe(3);
  });
});

describe("weekly property cashflow", () => {
  it("cash change = rent - maintenance - payment - housing rent - living costs", () => {
    const s0 = buyStudio(tier1({ rngState: noVacancy(1) }));
    const m0 = mortgage(s0)!;
    const s1 = step(s0, IDLE).state;
    const city = CONFIG.cities.kingston;
    const maintenance = round2((30000 * 0.01) / 52);
    const expected =
      60 - maintenance - m0.weeklyPaymentUsd - city.housingTiers[0]!.weeklyRentUsd - city.weeklyLivingCostUsd;
    expect(s1.cashUsd).toBe(round2(s0.cashUsd + expected));
  });

  it("charges each mortgage payment exactly once per step", () => {
    const s0 = buyStudio(tier1({ rngState: noVacancy(10) }));
    const pay = mortgage(s0)!.weeklyPaymentUsd;
    let s = s0;
    for (let i = 0; i < 10; i++) {
      const next = step(s, IDLE).state;
      const maintenance = round2((property(s).bookValueUsd * 0.01) / 52);
      expect(next.cashUsd).toBe(round2(s.cashUsd + 60 - maintenance - pay - 150));
      s = next;
    }
  });

  it("reduces principal by payment minus principal x 0.09 / 52", () => {
    const s0 = buyStudio(tier1({ rngState: noVacancy(3) }));
    let s = s0;
    for (let i = 0; i < 3; i++) {
      const m = mortgage(s)!;
      const next = step(s, IDLE).state;
      const expected = round2(m.principalUsd - (m.weeklyPaymentUsd - (m.principalUsd * 0.09) / 52));
      expect(mortgage(next)!.principalUsd).toBe(expected);
      expect(mortgage(next)!.weeksRemaining).toBe(m.weeksRemaining - 1);
      s = next;
    }
  });

  it("adds rent once with 1 occupied property and 0 businesses", () => {
    const s0 = buyStudio(tier1({ rngState: noVacancy(1) }), 30000);
    const s1 = step(s0, IDLE).state;
    const maintenance = round2((30000 * 0.01) / 52);
    expect(s1.cashUsd).toBe(round2(s0.cashUsd + 60 - maintenance - 150));
  });

  it("charges maintenance on a vacant property and pays no rent", () => {
    const base = buyStudio(tier1(), 30000);
    const vacant: GameState = {
      ...base,
      rngState: noVacancy(1),
      assets: [{ ...base.assets[0]!, occupied: false, vacantWeeksRemaining: 3 }],
    };
    const s1 = step(vacant, IDLE).state;
    expect(s1.cashUsd).toBe(round2(vacant.cashUsd - round2((30000 * 0.01) / 52) - 150));
  });

  it("pays off the mortgage and removes it on the final week", () => {
    const base = buyStudio(tier1({ rngState: noVacancy(2) }));
    const m = mortgage(base)!;
    const last: GameState = {
      ...base,
      liabilities: [{ ...m, principalUsd: 100, weeksRemaining: 1 }],
    };
    const s1 = step(last, IDLE).state;
    expect(mortgage(s1)).toBeUndefined();
    const maintenance = round2((30000 * 0.01) / 52);
    const payoff = round2(100 + (100 * 0.09) / 52);
    expect(s1.cashUsd).toBe(round2(last.cashUsd + 60 - maintenance - payoff - 150));
  });
});

describe("vacancy", () => {
  it("draw below 0.015: vacant for exactly 6 steps, no rent, occupied again on step 7", () => {
    // Step 1 property draw < 0.015; step 7 draw >= 0.015 so the property stays let on re-entry.
    const rng = findRng(7, 1, (d) => d[0]![0]! < VAC && d[6]![0]! >= VAC);
    let s = buyStudio(tier1({ rngState: rng }), 30000);
    for (let i = 1; i <= 7; i++) {
      const book = property(s).bookValueUsd;
      const next = step(s, IDLE).state;
      const rent = i <= 6 ? 0 : 60;
      expect(next.cashUsd).toBe(round2(s.cashUsd + rent - round2((book * 0.01) / 52) - 150));
      expect(property(next).occupied).toBe(i === 7);
      s = next;
    }
  });

  it("draws no RNG when the player owns no property", () => {
    const s0 = newGame(7);
    const s1 = step(s0, IDLE).state;
    expect(s1.rngState).toBe(nextRandom(s0.rngState)[1]);
  });

  it("draws exactly one value per owned property", () => {
    let s0 = tier1({ cashUsd: 100_000 });
    s0 = buyStudio(buyStudio(s0));
    const s1 = step(s0, IDLE).state;
    const afterHustle = nextRandom(s0.rngState)[1];
    expect(s1.rngState).toBe(nextRandom(nextRandom(afterHustle)[1])[1]);
  });
});

describe("appreciation", () => {
  it("book value is round2(price x 1.04) after 52 steps and compounds after 104", () => {
    let s = buyStudio(tier1({ cashUsd: 500_000 }), 30000);
    s = run(s, 51);
    expect(property(s).bookValueUsd).toBe(30000);
    s = run(s, 1);
    expect(property(s).bookValueUsd).toBe(round2(30000 * 1.04));
    s = run(s, 52);
    expect(property(s).bookValueUsd).toBe(round2(round2(30000 * 1.04) * 1.04));
  });

  it("anniversary counts from the purchase week, not game start", () => {
    let s = run(tier1({ cashUsd: 500_000 }), 10);
    s = { ...s, wealthTier: 1 };
    s = buyStudio(s, 30000);
    s = run(s, 52);
    expect(property(s).bookValueUsd).toBe(round2(30000 * 1.04));
  });
});

describe("sellProperty", () => {
  it("adds book x 0.95 - principal, removes asset and mortgage, tags sold_property", () => {
    const s0 = buyStudio(tier1());
    const id = property(s0).id;
    const [s1, err] = sellProperty(s0, id);
    expect(err).toBeNull();
    expect(s1.cashUsd).toBe(round2(s0.cashUsd + 30000 * 0.95 - 24000));
    expect(s1.assets).toHaveLength(0);
    expect(s1.liabilities).toHaveLength(0);
    expect(s1.history.at(-1)!.tags).toContain("sold_property");
  });

  it("proceeds can be negative", () => {
    const s0 = buyStudio(tier1());
    const a = property(s0);
    const crashed: GameState = { ...s0, assets: [{ ...a, bookValueUsd: 20000 }] };
    const [s1] = sellProperty(crashed, a.id);
    expect(s1.cashUsd).toBe(round2(crashed.cashUsd + 20000 * 0.95 - 24000));
  });

  it("keeps other liabilities", () => {
    const s0 = takeLoan(buyStudio(tier1({ reputation: 50 })), 500, 26)[0];
    const [s1] = sellProperty(s0, property(s0).id);
    expect(s1.liabilities).toHaveLength(1);
    expect(s1.liabilities[0]!.kind).not.toBe("mortgage");
  });

  it("unknown asset id returns an error and the unchanged state", () => {
    const s0 = buyStudio(tier1());
    const [s1, err] = sellProperty(s0, "nope");
    expect(err).not.toBeNull();
    expect(s1).toBe(s0);
  });

  it("rejects a non-property asset", () => {
    const s0 = tier1({
      assets: [{ id: "biz_food_stall_0", type: "food_stall", bookValueUsd: 2000, weeklyIncomeUsd: 180 }],
    });
    const [s1, err] = sellProperty(s0, "biz_food_stall_0");
    expect(err).not.toBeNull();
    expect(s1).toBe(s0);
  });
});

describe("net worth and loans", () => {
  it("netWorthUsd includes book value and subtracts mortgage principal", () => {
    const s = buyStudio(tier1());
    expect(netWorthUsd(s)).toBe(round2(s.cashUsd + 30000 - 24000));
  });

  it("mortgages do not count toward loans.maxSimultaneous: tier 1 with 1 mortgage takes 2 loans", () => {
    let s = buyStudio(tier1({ reputation: 50 }));
    let err: string | null;
    [s, err] = takeLoan(s, 500, 26);
    expect(err).toBeNull();
    [s, err] = takeLoan(s, 500, 26);
    expect(err).toBeNull();
    expect(s.liabilities).toHaveLength(3);
    const [, third] = takeLoan(s, 500, 26);
    expect(third).not.toBeNull();
  });

  it("regular loans keep amortizing and the mortgage is untouched by loan repayment", () => {
    let s = takeLoan(buyStudio(tier1({ reputation: 50, rngState: noVacancy(1) })), 500, 26)[0];
    const loan = s.liabilities.find((l) => l.kind !== "mortgage")!;
    s = step(s, IDLE).state;
    expect(s.liabilities.find((l) => l.id === loan.id)!.weeksRemaining).toBe(25);
    expect(mortgage(s)!.weeksRemaining).toBe(1039);
  });
});

describe("serialize / deserialize", () => {
  it("round-trips 1 vacant and 1 occupied property with mortgages", () => {
    let s = tier1({ cashUsd: 100_000 });
    s = buyStudio(s);
    const [s2, err] = buyProperty(s, "kgn_two_bed", 13000, 520);
    expect(err).toBeNull();
    s = { ...s2, assets: s2.assets.map((a, i) => (i === 0 ? { ...a, occupied: false, vacantWeeksRemaining: 4 } : a)) };
    expect(s.liabilities.filter((l) => l.kind === "mortgage")).toHaveLength(2);
    const back = deserialize(serialize(s));
    expect(back).toEqual(s);
    expect(step(back, IDLE).state).toEqual(step(s, IDLE).state);
  });
});
