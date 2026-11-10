// SM-015 golden master. Values captured from the pre-refactor sim/index.ts (commit 31981f9).
// Any change here means sim behavior changed. A pure refactor must leave this green.
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
      "cashUsd": 147437.18,
      "energy": 100,
      "reputation": 100,
      "netWorthUsd": 148437.18,
      "wealthTier": 1,
      "housingTier": 1,
      "activeJobId": "full_time",
      "rngState": 2154614940,
      "historyLength": 46,
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
      "stateHash": "4e6b8aff"
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
      "stateHash": "596b4b9a"
    });
  });

  it("is deterministic across repeated runs", () => {
    expect(runGolden(12345, 468, POLICY_A)).toEqual(runGolden(12345, 468, POLICY_A));
  });
});
