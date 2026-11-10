import { describe, expect, it } from "vitest";
import { deserialize, newGame, serialize, step, type WeekInput } from "../../sim";

const week: WeekInput = { hours: { work: 45, hustle: 10, rest: 45 } };

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
      a = step(a, week);
      b = step(b, week);
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
    for (let i = 0; i < 52; i++) s = step(s, week);
    expect(s.age).toBe(22);
  });

  it("rejects more than 100 hours", () => {
    expect(() => step(newGame(1), { hours: { work: 60, hustle: 30, rest: 20 } })).toThrow();
  });

  it("round-trips through serialize", () => {
    const s = step(newGame(9), week);
    expect(deserialize(serialize(s))).toEqual(s);
  });
});
