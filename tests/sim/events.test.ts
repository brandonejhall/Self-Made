import { describe, expect, it } from "vitest";
import {
  CONFIG,
  newGame,
  loadEvents,
  selectEvents,
  applyEvent,
  type GameEvent,
  type GameState,
} from "../../sim";
import stage1FamilyRaw from "../../content/events/stage1_family.json";

// Helper: override specific GameState fields on top of a fresh game
function withState(overrides: Partial<GameState>): GameState {
  return { ...newGame(42), ...overrides };
}

// Minimal in-memory event set used throughout these tests
const testAlways: GameEvent = {
  id: "test_always",
  stage: 1,
  title: "Always fires",
  body: "Body",
  trigger: { weight: 10 },
  choices: [
    { label: "OK", effects: { addTags: ["did_always"] } },
    { label: "Skip", effects: {} },
  ],
};

const testOnce: GameEvent = {
  id: "test_once",
  stage: 1,
  title: "Fires once",
  body: "Body",
  trigger: { once: true, weight: 10 },
  choices: [
    { label: "Yes", effects: { addTags: ["fired_once"] } },
    { label: "No", effects: {} },
  ],
};

const testMinWeek: GameEvent = {
  id: "test_min_week",
  stage: 1,
  title: "Requires minWeek",
  body: "Body",
  trigger: { minWeek: 100, weight: 10 },
  choices: [
    { label: "A", effects: {} },
    { label: "B", effects: {} },
  ],
};

const testRequiresTag: GameEvent = {
  id: "test_requires_tag",
  stage: 1,
  title: "Requires tag",
  body: "Body",
  trigger: { requiresTags: ["special_tag"], weight: 10 },
  choices: [
    { label: "A", effects: {} },
    { label: "B", effects: {} },
  ],
};

const testForbidsTag: GameEvent = {
  id: "test_forbids_tag",
  stage: 1,
  title: "Forbids tag",
  body: "Body",
  trigger: { forbidsTags: ["bad_tag"], weight: 10 },
  choices: [
    { label: "A", effects: {} },
    { label: "B", effects: {} },
  ],
};

// Make a pool of 5 events for maxPerWeek tests
function makePool(n: number): GameEvent[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `pool_event_${i}`,
    stage: 1,
    title: `Event ${i}`,
    body: "Body",
    trigger: { weight: 10 },
    choices: [
      { label: "A", effects: {} },
      { label: "B", effects: {} },
    ],
  }));
}

// ---- selectEvents ----

describe("selectEvents", () => {
  it("returns no events when pool is empty", () => {
    const state = newGame(1);
    const [selected, rng] = selectEvents(state, [], 42);
    expect(selected).toHaveLength(0);
    expect(rng).toBe(42); // rng unchanged when no events processed
  });

  it("respects once — event not selected after its id is in firedEvents", () => {
    const state = withState({ firedEvents: ["test_once"] });
    const [selected] = selectEvents(state, [testOnce], 42);
    expect(selected).toHaveLength(0);
  });

  it("selects a once event when it has NOT been fired yet", () => {
    const state = withState({ firedEvents: [] });
    const [selected] = selectEvents(state, [testOnce], 42);
    expect(selected).toHaveLength(1);
    expect(selected[0]!.id).toBe("test_once");
  });

  it("respects minWeek — event not selected before its week", () => {
    const state = withState({ week: 50 }); // week < minWeek(100)
    const [selected] = selectEvents(state, [testMinWeek], 42);
    expect(selected).toHaveLength(0);
  });

  it("selects event when week >= minWeek", () => {
    const state = withState({ week: 100 });
    const [selected] = selectEvents(state, [testMinWeek], 42);
    expect(selected).toHaveLength(1);
  });

  it("respects requiresTags — event not selected without required tag", () => {
    const state = withState({ history: [] }); // no tags
    const [selected] = selectEvents(state, [testRequiresTag], 42);
    expect(selected).toHaveLength(0);
  });

  it("selects event when all requiresTags are present in history", () => {
    const state = withState({
      history: [{ week: 1, action: "some_action", tags: ["special_tag"] }],
    });
    const [selected] = selectEvents(state, [testRequiresTag], 42);
    expect(selected).toHaveLength(1);
  });

  it("respects forbidsTags — event not selected when forbidden tag is present", () => {
    const state = withState({
      history: [{ week: 1, action: "some_action", tags: ["bad_tag"] }],
    });
    const [selected] = selectEvents(state, [testForbidsTag], 42);
    expect(selected).toHaveLength(0);
  });

  it("selects event when no forbidden tag is present", () => {
    const state = withState({ history: [] });
    const [selected] = selectEvents(state, [testForbidsTag], 42);
    expect(selected).toHaveLength(1);
  });

  it("returns at most CONFIG.events.maxPerWeek events", () => {
    const pool = makePool(10); // 10 eligible events
    const state = newGame(1);
    const [selected] = selectEvents(state, pool, 42);
    expect(selected.length).toBeLessThanOrEqual(CONFIG.events.maxPerWeek);
    expect(selected).toHaveLength(CONFIG.events.maxPerWeek);
  });

  it("weighted selection is reproducible for the same rngState", () => {
    const pool = makePool(5);
    const state = newGame(1);
    const rngSeed = 999;
    const [selected1] = selectEvents(state, pool, rngSeed);
    const [selected2] = selectEvents(state, pool, rngSeed);
    expect(selected1.map((e) => e.id)).toEqual(selected2.map((e) => e.id));
  });

  it("advances the rngState when events are selected", () => {
    const state = newGame(1);
    const rngSeed = 999;
    const [, finalRng] = selectEvents(state, [testAlways], rngSeed);
    expect(finalRng).not.toBe(rngSeed);
  });

  it("respects cities filter — rejects when cityId not in list", () => {
    const event: GameEvent = {
      id: "test_city",
      stage: 1,
      title: "City event",
      body: "Body",
      trigger: { cities: ["new_york"], weight: 10 },
      choices: [
        { label: "A", effects: {} },
        { label: "B", effects: {} },
      ],
    };
    const state = withState({ cityId: "kingston" });
    const [selected] = selectEvents(state, [event], 42);
    expect(selected).toHaveLength(0);
  });

  it("respects minYearsAfterTag — rejects when tag was added too recently", () => {
    const event: GameEvent = {
      id: "test_years_after",
      stage: 1,
      title: "Years after tag",
      body: "Body",
      trigger: { requiresTags: ["took_loan"], minYearsAfterTag: 2, weight: 10 },
      choices: [
        { label: "A", effects: {} },
        { label: "B", effects: {} },
      ],
    };
    // Tag was added at week 50, state.week = 90, minYearsAfterTag = 2 (104 weeks)
    // 90 - 50 = 40 < 104, so should be rejected
    const state = withState({
      week: 90,
      history: [{ week: 50, action: "took_loan_500", tags: ["took_loan"] }],
    });
    const [selected] = selectEvents(state, [event], 42);
    expect(selected).toHaveLength(0);
  });

  it("respects minYearsAfterTag — selects when tag is old enough", () => {
    const event: GameEvent = {
      id: "test_years_after",
      stage: 1,
      title: "Years after tag",
      body: "Body",
      trigger: { requiresTags: ["took_loan"], minYearsAfterTag: 1, weight: 10 },
      choices: [
        { label: "A", effects: {} },
        { label: "B", effects: {} },
      ],
    };
    // Tag was added at week 1, state.week = 60, minYearsAfterTag = 1 (52 weeks)
    // 60 - 1 = 59 >= 52, so should be selected
    const state = withState({
      week: 60,
      history: [{ week: 1, action: "took_loan_500", tags: ["took_loan"] }],
    });
    const [selected] = selectEvents(state, [event], 42);
    expect(selected).toHaveLength(1);
  });
});

// ---- applyEvent ----

describe("applyEvent", () => {
  const cashEvent: GameEvent = {
    id: "cash_event",
    stage: 1,
    title: "Cash event",
    body: "Body",
    trigger: {},
    choices: [
      { label: "Take it", effects: { cashUsd: 500 } },
      { label: "Decline", effects: { cashUsd: -100 } },
    ],
  };

  const tagEvent: GameEvent = {
    id: "tag_event",
    stage: 1,
    title: "Tag event",
    body: "Body",
    trigger: {},
    choices: [
      { label: "Yes", effects: { addTags: ["important_tag", "second_tag"] } },
      { label: "No", effects: {} },
    ],
  };

  const flagEvent: GameEvent = {
    id: "flag_event",
    stage: 1,
    title: "Flag event",
    body: "Body",
    trigger: {},
    choices: [
      { label: "Set it", effects: { setFlags: ["my_flag", "another_flag"] } },
      { label: "Skip", effects: {} },
    ],
  };

  const trustEvent: GameEvent = {
    id: "trust_event",
    stage: 1,
    title: "Trust event",
    body: "Body",
    trigger: {},
    choices: [
      { label: "Help", effects: { trust: { mentor_daryl: 10, friend_alice: 5 } } },
      { label: "Ignore", effects: {} },
    ],
  };

  const allEffectsEvent: GameEvent = {
    id: "all_effects",
    stage: 1,
    title: "All effects",
    body: "Body",
    trigger: {},
    choices: [
      {
        label: "Do it",
        effects: {
          cashUsd: 100,
          energy: -10,
          reputation: 5,
          trust: { mentor: 3 },
          addTags: ["did_all"],
          setFlags: ["all_done"],
        },
      },
      { label: "Skip", effects: {} },
    ],
  };

  const events = [cashEvent, tagEvent, flagEvent, trustEvent, allEffectsEvent];

  it("applies cashUsd effect to state", () => {
    const state = withState({ cashUsd: 1000 });
    const next = applyEvent(state, "cash_event", 0, events);
    expect(next.cashUsd).toBe(1500);
  });

  it("applies negative cashUsd effect", () => {
    const state = withState({ cashUsd: 1000 });
    const next = applyEvent(state, "cash_event", 1, events);
    expect(next.cashUsd).toBe(900);
  });

  it("applies addTags — new HistoryEntry is appended", () => {
    const state = withState({ week: 5, history: [] });
    const next = applyEvent(state, "tag_event", 0, events);
    expect(next.history).toHaveLength(1);
    const entry = next.history[0]!;
    expect(entry.week).toBe(5);
    expect(entry.action).toBe("tag_event");
    expect(entry.tags).toContain("important_tag");
    expect(entry.tags).toContain("second_tag");
  });

  it("does not append history entry when no addTags in effects", () => {
    const state = withState({ week: 5, history: [] });
    const next = applyEvent(state, "tag_event", 1, events); // choice 1 has no effects
    expect(next.history).toHaveLength(0);
  });

  it("applies setFlags — sets each flag to true in state.flags", () => {
    const state = withState({ flags: {} });
    const next = applyEvent(state, "flag_event", 0, events);
    expect(next.flags["my_flag"]).toBe(true);
    expect(next.flags["another_flag"]).toBe(true);
  });

  it("applies trust delta — merges into existing trust values", () => {
    const state = withState({ trust: { mentor_daryl: 20 } });
    const next = applyEvent(state, "trust_event", 0, events);
    expect(next.trust["mentor_daryl"]).toBe(30); // 20 + 10
    expect(next.trust["friend_alice"]).toBe(5); // 0 + 5
  });

  it("adds event id to firedEvents", () => {
    const state = withState({ firedEvents: [] });
    const next = applyEvent(state, "cash_event", 0, events);
    expect(next.firedEvents).toContain("cash_event");
  });

  it("adds to existing firedEvents without removing prior entries", () => {
    const state = withState({ firedEvents: ["prior_event"] });
    const next = applyEvent(state, "cash_event", 0, events);
    expect(next.firedEvents).toContain("prior_event");
    expect(next.firedEvents).toContain("cash_event");
  });

  it("clamps energy to [0, 100]", () => {
    const lowEnergyEvent: GameEvent = {
      id: "drain_event",
      stage: 1,
      title: "Drain",
      body: "Body",
      trigger: {},
      choices: [
        { label: "Drain", effects: { energy: -200 } },
        { label: "Skip", effects: {} },
      ],
    };
    const state = withState({ energy: 10 });
    const next = applyEvent(state, "drain_event", 0, [lowEnergyEvent]);
    expect(next.energy).toBe(0);
  });

  it("does not mutate the input state", () => {
    const state = withState({ cashUsd: 1000, firedEvents: [] });
    const copy = structuredClone(state);
    applyEvent(state, "cash_event", 0, events);
    expect(state).toEqual(copy);
  });

  it("throws when event id is not found", () => {
    const state = newGame(1);
    expect(() => applyEvent(state, "nonexistent_event", 0, events)).toThrow();
  });

  it("throws when choiceIndex is out of range", () => {
    const state = newGame(1);
    expect(() => applyEvent(state, "cash_event", 99, events)).toThrow();
  });
});

// ---- loadEvents ----

describe("loadEvents", () => {
  it("returns valid GameEvent[] for the real grandmother_shoebox event JSON", () => {
    const loaded = loadEvents(stage1FamilyRaw as unknown[]);
    expect(loaded.length).toBeGreaterThanOrEqual(1);
    const evt = loaded.find(e => e.id === "grandmother_shoebox")!;
    expect(evt.id).toBe("grandmother_shoebox");
    expect(evt.stage).toBe(1);
    expect(typeof evt.title).toBe("string");
    expect(typeof evt.body).toBe("string");
    expect(evt.choices).toHaveLength(3);
  });

  it("throws on event missing id", () => {
    const bad = [{ stage: 1, title: "T", body: "B", trigger: {}, choices: [{ label: "A", effects: {} }, { label: "B", effects: {} }] }];
    expect(() => loadEvents(bad)).toThrow();
  });

  it("throws on event with invalid id (contains uppercase)", () => {
    const bad = [{ id: "Bad_ID", stage: 1, title: "T", body: "B", trigger: {}, choices: [{ label: "A", effects: {} }, { label: "B", effects: {} }] }];
    expect(() => loadEvents(bad)).toThrow();
  });

  it("throws on event missing stage", () => {
    const bad = [{ id: "valid_id", title: "T", body: "B", trigger: {}, choices: [{ label: "A", effects: {} }, { label: "B", effects: {} }] }];
    expect(() => loadEvents(bad)).toThrow();
  });

  it("throws on event missing title", () => {
    const bad = [{ id: "valid_id", stage: 1, body: "B", trigger: {}, choices: [{ label: "A", effects: {} }, { label: "B", effects: {} }] }];
    expect(() => loadEvents(bad)).toThrow();
  });

  it("throws on event missing body", () => {
    const bad = [{ id: "valid_id", stage: 1, title: "T", trigger: {}, choices: [{ label: "A", effects: {} }, { label: "B", effects: {} }] }];
    expect(() => loadEvents(bad)).toThrow();
  });

  it("throws on event missing trigger", () => {
    const bad = [{ id: "valid_id", stage: 1, title: "T", body: "B", choices: [{ label: "A", effects: {} }, { label: "B", effects: {} }] }];
    expect(() => loadEvents(bad)).toThrow();
  });

  it("throws on event with only 1 choice (minimum is 2)", () => {
    const bad = [{ id: "valid_id", stage: 1, title: "T", body: "B", trigger: {}, choices: [{ label: "A", effects: {} }] }];
    expect(() => loadEvents(bad)).toThrow();
  });

  it("throws on event with 5 choices (maximum is 4)", () => {
    const fiveChoices = Array.from({ length: 5 }, (_, i) => ({ label: `Choice ${i}`, effects: {} }));
    const bad = [{ id: "valid_id", stage: 1, title: "T", body: "B", trigger: {}, choices: fiveChoices }];
    expect(() => loadEvents(bad)).toThrow();
  });

  it("includes the failing event id in the error message", () => {
    const bad = [{ id: "my_event_id", stage: 1, body: "B", trigger: {}, choices: [{ label: "A", effects: {} }, { label: "B", effects: {} }] }];
    expect(() => loadEvents(bad)).toThrow(/my_event_id/);
  });

  it("returns an empty array for an empty input", () => {
    expect(loadEvents([])).toEqual([]);
  });

  it("returns multiple events when input has multiple valid events", () => {
    const two = [
      { id: "evt_one", stage: 1, title: "One", body: "B", trigger: {}, choices: [{ label: "A", effects: {} }, { label: "B", effects: {} }] },
      { id: "evt_two", stage: 1, title: "Two", body: "B", trigger: { once: true }, choices: [{ label: "X", effects: {} }, { label: "Y", effects: {} }] },
    ];
    const loaded = loadEvents(two);
    expect(loaded).toHaveLength(2);
    expect(loaded[0]!.id).toBe("evt_one");
    expect(loaded[1]!.id).toBe("evt_two");
  });
});
