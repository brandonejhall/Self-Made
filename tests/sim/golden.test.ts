// SM-015 golden master. Values captured from the pre-refactor sim/index.ts (commit 31981f9).
// Any change here means sim behavior changed. A pure refactor must leave this green.
// SM-017 re-recorded policy A: business failure draws (1 per owned business per week) shift the
// RNG; the food stall fails at week 86 and is relaunched. Policy B never owns a business: unchanged.
// SM-020 re-recorded stateHash only (both policies): serialize now includes stage1Complete, summary,
// choiceLog and maxWealthTier. Every other field, including rngState, is unchanged.
import { describe, expect, it } from "vitest";
import { ALL_EVENTS, POLICY_A, POLICY_B, runGolden } from "./golden.helpers";

describe("golden runs (468 weeks)", () => {
  it("loads every content event", () => {
    expect(ALL_EVENTS.length).toBe(40);
  });

  it("seed 12345, policy A (full-time job, loans, housing, business) matches the golden snapshot", () => {
    expect(runGolden(12345, 468, POLICY_A)).toEqual({
      "week": 468,
      "age": 30,
      "cashUsd": 145246.45,
      "energy": 100,
      "reputation": 100,
      "netWorthUsd": 146246.45,
      "wealthTier": 1,
      "housingTier": 1,
      "activeJobId": "full_time",
      "rngState": 2237039534,
      "historyLength": 48,
      "firedEventsCount": 35,
      "eventsShown": 35,
      "assetsCount": 1,
      "liabilitiesCount": 1,
      "skills": {
        "financial": 780,
        "hustle": 780,
        "negotiation": 780
      },
      "flags": {
        "skill_financial_unlocked": true,
        "owns_portmore_plot": true,
        "mystery_zurich_open": true
      },
      "stateHash": "55abacba"
    });
  });

  it("seed 999, policy B (part-time, quit, gig, burnout, eviction) matches the golden snapshot", () => {
    expect(runGolden(999, 468, POLICY_B)).toEqual({
      "week": 468,
      "age": 30,
      "cashUsd": -60289.68,
      "energy": 0,
      "reputation": 100,
      "netWorthUsd": -61189.68,
      "wealthTier": 0,
      "housingTier": 0,
      "activeJobId": "gig",
      "rngState": 1522767924,
      "historyLength": 265,
      "firedEventsCount": 37,
      "eventsShown": 37,
      "assetsCount": 0,
      "liabilitiesCount": 5,
      "skills": {
        "negotiation": 936,
        "financial": 2808
      },
      "flags": {
        "skill_financial_unlocked": true,
        "burnout_active": true,
        "owns_portmore_plot": true,
        "mystery_zurich_open": true
      },
      "stateHash": "4c340198"
    });
  });

  it("is deterministic across repeated runs", () => {
    expect(runGolden(12345, 468, POLICY_A)).toEqual(runGolden(12345, 468, POLICY_A));
  });
});
