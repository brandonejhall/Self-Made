// SM-020: the run ends at week 468 with the GDD 15.1 summary.
import { describe, expect, it } from "vitest";
import {
  CONFIG,
  applyEvent,
  deserialize,
  netWorthUsd,
  newGame,
  serialize,
  step,
  type GameEvent,
  type GameState,
  type WeekInput,
} from "../../sim";
import { topChoices } from "../../sim/systems/endOfRun";

const INPUT: WeekInput = { hours: { work: 40, hustle: 10, rest: 50 } };
const END = CONFIG.progression.stage1EndWeek;

function ev(id: string, cashDeltas: number[], trigger: GameEvent["trigger"] = {}): GameEvent {
  return {
    id,
    stage: 1,
    title: id,
    body: id,
    trigger,
    choices: cashDeltas.map((cashUsd, i) => ({ label: `c${i}`, effects: { cashUsd } })),
  };
}

function run(s: GameState, weeks: number, events: GameEvent[] = []): GameState {
  let st = s;
  for (let i = 0; i < weeks; i++) st = step(st, INPUT, events).state;
  return st;
}

describe("config", () => {
  it("stage1EndWeek is 468 and summaryTopChoices is 5", () => {
    expect(CONFIG.progression.stage1EndWeek).toBe(468);
    expect(CONFIG.progression.summaryTopChoices).toBe(5);
  });
});

describe("newGame end-of-run fields", () => {
  it("starts incomplete with no summary, an empty choice log and maxWealthTier 0", () => {
    const s = newGame(1);
    expect(s.stage1Complete).toBe(false);
    expect(s.summary).toBeNull();
    expect(s.choiceLog).toEqual([]);
    expect(s.maxWealthTier).toBe(0);
  });
});

describe("applyEvent choiceLog", () => {
  it("appends one entry with the net worth delta", () => {
    const e = ev("windfall", [500, -200]);
    const before = { ...newGame(1), week: 7 };
    const after = applyEvent(before, "windfall", 1, [e]);
    expect(after.choiceLog).toHaveLength(1);
    expect(after.choiceLog[0]).toEqual({
      week: 7,
      eventId: "windfall",
      choiceIndex: 1,
      netWorthDeltaUsd: netWorthUsd(after) - netWorthUsd(before),
    });
    expect(after.choiceLog[0]!.netWorthDeltaUsd).toBe(-200);
    expect(before.choiceLog).toEqual([]);
  });

  it("logs a zero delta for a choice with no cash effect", () => {
    const e: GameEvent = {
      ...ev("talk", [0, 0]),
      choices: [{ label: "a", effects: { reputation: 5 } }, { label: "b", effects: {} }],
    };
    const after = applyEvent(newGame(1), "talk", 0, [e]);
    expect(after.choiceLog[0]!.netWorthDeltaUsd).toBe(0);
  });
});

describe("run end at week 468", () => {
  it("is incomplete after 467 steps and complete with a summary after step 468", () => {
    const s467 = run(newGame(42), END - 1);
    expect(s467.week).toBe(467);
    expect(s467.stage1Complete).toBe(false);
    expect(s467.summary).toBeNull();

    const { state: s468, pendingEvents } = step(s467, INPUT, []);
    expect(s468.week).toBe(468);
    expect(s468.stage1Complete).toBe(true);
    expect(s468.summary).not.toBeNull();
    expect(pendingEvents).toEqual([]);
  });

  it("summary.finalNetWorthUsd equals netWorthUsd at week 468", () => {
    const s = run(newGame(42), END);
    expect(s.summary!.finalNetWorthUsd).toBe(netWorthUsd(s));
  });

  it("step() on a completed state throws 'Stage 1 is complete'", () => {
    const s = run(newGame(42), END);
    expect(() => step(s, INPUT, [])).toThrow("Stage 1 is complete");
  });

  it("does not mutate the input state", () => {
    const s467 = run(newGame(42), END - 1);
    const snapshot = serialize(s467);
    step(s467, INPUT, []);
    expect(serialize(s467)).toBe(snapshot);
  });
});

describe("wealthTierReached", () => {
  it("keeps the highest tier when the run reaches tier 2 and drops back", () => {
    const s = { ...run(newGame(3), 100), cashUsd: 2_000_000 };
    const rich = step(s, INPUT, []).state;
    expect(rich.wealthTier).toBe(2);
    expect(rich.maxWealthTier).toBe(2);

    const poor = step({ ...rich, cashUsd: 100 }, INPUT, []).state;
    expect(poor.wealthTier).toBe(0);
    expect(poor.maxWealthTier).toBe(2);

    const end = run(poor, END - poor.week);
    expect(end.week).toBe(END);
    expect(end.wealthTier).toBe(0);
    expect(end.summary!.wealthTierReached).toBe(2);
  });

  it("reaching $1M before week 468 sets stage2_unlocked and does not end the run", () => {
    const s = { ...run(newGame(3), 10), cashUsd: 1_500_000 };
    const next = step(s, INPUT, []).state;
    expect(next.flags.stage2_unlocked).toBe(true);
    expect(next.stage1Complete).toBe(false);
    expect(next.summary).toBeNull();
    expect(() => step(next, INPUT, [])).not.toThrow();
  });
});

describe("topChoices", () => {
  const entry = (week: number, netWorthDeltaUsd: number, eventId = `e${week}`) => ({
    week,
    eventId,
    choiceIndex: 0,
    netWorthDeltaUsd,
  });

  it("holds the 5 largest |delta| entries, sorted descending, ties by earlier week", () => {
    const log = [
      entry(1, 100),
      entry(2, -900),
      entry(3, 50),
      entry(4, 300),
      entry(5, -300),
      entry(6, 10),
      entry(7, 700),
      entry(8, 300),
    ];
    const s = { ...newGame(1), week: END - 1, choiceLog: log };
    const summary = step(s, INPUT, []).state.summary!;
    expect(summary.topChoices).toEqual([
      entry(2, -900),
      entry(7, 700),
      entry(4, 300),
      entry(5, -300),
      entry(8, 300),
    ]);
  });

  it("holds 3 entries when the log has 3", () => {
    const log = [entry(1, 10), entry(2, -20), entry(3, 5)];
    const s = { ...newGame(1), week: END - 1, choiceLog: log };
    const summary = step(s, INPUT, []).state.summary!;
    expect(summary.topChoices).toEqual([entry(2, -20), entry(1, 10), entry(3, 5)]);
  });

  it("keeps log order for same-week ties", () => {
    const log = [entry(4, 50, "a"), entry(4, -50, "b")];
    expect(topChoices(log, 5).map((c) => c.eventId)).toEqual(["a", "b"]);
  });

  it("collects entries logged by applyEvent during a real run", () => {
    const events = [ev("cash_gift", [250, -40], { weight: 10 })];
    let s = newGame(9);
    for (let i = 0; i < END; i++) {
      const res = step(s, INPUT, events);
      s = res.state;
      for (const p of res.pendingEvents) s = applyEvent(s, p.id, s.week % 2, events);
    }
    expect(s.stage1Complete).toBe(true);
    expect(s.choiceLog.length).toBeGreaterThan(5);
    expect(s.summary!.topChoices).toHaveLength(5);
    expect(s.summary!.topChoices.every((c) => c.netWorthDeltaUsd === 250)).toBe(true);
    const weeks = s.summary!.topChoices.map((c) => c.week);
    expect(weeks).toEqual([...weeks].sort((a, b) => a - b));
  });
});

describe("consequencesFired", () => {
  it("lists fired delayed-consequence ids in firing order, using the events passed to step()", () => {
    const events = [
      ev("plain", [0, 0]),
      ev("debt_collector", [0, 0], { requiresTags: ["took_loan"], minYearsAfterTag: 1 }),
      ev("old_partner", [0, 0], { requiresTags: ["cut_partner"], minYearsAfterTag: 2 }),
    ];
    const s = {
      ...newGame(1),
      week: END - 1,
      firedEvents: ["old_partner", "plain", "unknown_event", "debt_collector", "plain"],
    };
    const summary = step(s, INPUT, events).state.summary!;
    expect(summary.consequencesFired).toEqual(["old_partner", "debt_collector"]);
  });

  it("is empty when no events are passed to step()", () => {
    const s = { ...newGame(1), week: END - 1, firedEvents: ["debt_collector"] };
    expect(step(s, INPUT, []).state.summary!.consequencesFired).toEqual([]);
  });
});

describe("save compatibility", () => {
  it("round-trips a completed state with a summary", () => {
    const events = [ev("cash_gift", [250, -40])];
    let s = newGame(5);
    for (let i = 0; i < END; i++) {
      const res = step(s, INPUT, events);
      s = res.state;
      for (const p of res.pendingEvents) s = applyEvent(s, p.id, 0, events);
    }
    expect(s.summary).not.toBeNull();
    const loaded = deserialize(serialize(s));
    expect(loaded).toEqual(s);
    expect(() => step(loaded, INPUT, events)).toThrow("Stage 1 is complete");
  });

  it("loads a save made before SM-020 and fills defaults", () => {
    const current = run(newGame(77), 30);
    const {
      stage1Complete: _a,
      summary: _b,
      choiceLog: _c,
      maxWealthTier: _d,
      ...old
    } = { ...current, wealthTier: 1 };
    const json = JSON.stringify(old);
    expect(json).not.toContain("stage1Complete");

    const loaded = deserialize(json);
    expect(loaded.stage1Complete).toBe(false);
    expect(loaded.summary).toBeNull();
    expect(loaded.choiceLog).toEqual([]);
    expect(loaded.maxWealthTier).toBe(1);
    expect(loaded.week).toBe(30);
    expect(loaded.cashUsd).toBe(current.cashUsd);

    const next = step(loaded, INPUT, []).state;
    expect(next.week).toBe(31);
    expect(next.maxWealthTier).toBeGreaterThanOrEqual(1);
  });

  it("an old save past week 468 completes on its next step", () => {
    const { stage1Complete: _a, summary: _b, choiceLog: _c, maxWealthTier: _d, ...old } = {
      ...newGame(2),
      week: 470,
    };
    const loaded = deserialize(JSON.stringify(old));
    const next = step(loaded, INPUT, []).state;
    expect(next.stage1Complete).toBe(true);
    expect(next.summary!.finalNetWorthUsd).toBe(netWorthUsd(next));
  });
});
