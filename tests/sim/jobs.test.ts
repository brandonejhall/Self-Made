import { describe, expect, it } from "vitest";
import {
  holdJob,
  quitJob,
  newGame,
  step,
  validateInput,
  CONFIG,
  type GameState,
  type WeekInput,
} from "../../sim";

// Helper to get a fresh game state
function fresh(): GameState {
  return newGame(42);
}

// Helper to call step and get the new state
function doStep(state: GameState, input: WeekInput): GameState {
  return step(state, input).state;
}

const basicInput: WeekInput = { hours: { work: 40, hustle: 0, rest: 60 } };

describe("holdJob", () => {
  it("sets activeJobId to the given job id", () => {
    const [s] = holdJob(fresh(), "part_time");
    expect(s.activeJobId).toBe("part_time");
  });

  it("resets underHoursWeeks to 0 when taking a new job", () => {
    let s = fresh();
    // Manually set underHoursWeeks > 0
    s = { ...s, underHoursWeeks: 3 };
    const [s2] = holdJob(s, "part_time");
    expect(s2.underHoursWeeks).toBe(0);
  });

  it("appends a took_job_<id> history entry with matching tag", () => {
    const [s] = holdJob(fresh(), "full_time");
    const last = s.history[s.history.length - 1]!;
    expect(last.action).toBe("took_job_full_time");
    expect(last.tags).toContain("took_job_full_time");
  });

  it("returns an error string for unknown job id", () => {
    const [s, err] = holdJob(fresh(), "nonexistent");
    expect(err).toMatch(/Unknown job id/);
    expect(s.activeJobId).toBeNull(); // state unchanged
  });

  it("does not mutate the input state", () => {
    const original = fresh();
    const copy = structuredClone(original);
    holdJob(original, "gig");
    expect(original).toEqual(copy);
  });
});

describe("quitJob", () => {
  it("clears activeJobId to null", () => {
    const [withJob] = holdJob(fresh(), "part_time");
    const [s] = quitJob(withJob);
    expect(s.activeJobId).toBeNull();
  });

  it("appends a quit_job_<id> history entry with matching tag", () => {
    const [withJob] = holdJob(fresh(), "skilled");
    const [s] = quitJob(withJob);
    const last = s.history[s.history.length - 1]!;
    expect(last.action).toBe("quit_job_skilled");
    expect(last.tags).toContain("quit_job_skilled");
  });

  it("resets underHoursWeeks to 0", () => {
    let [withJob] = holdJob(fresh(), "part_time");
    withJob = { ...withJob, underHoursWeeks: 2 };
    const [s] = quitJob(withJob);
    expect(s.underHoursWeeks).toBe(0);
  });

  it("returns an error string when no active job", () => {
    const [s, err] = quitJob(fresh());
    expect(err).toMatch(/No active job/);
  });

  it("does not mutate the input state", () => {
    const [withJob] = holdJob(fresh(), "gig");
    const copy = structuredClone(withJob);
    quitJob(withJob);
    expect(withJob).toEqual(copy);
  });
});

describe("step() job wages", () => {
  it("earns baseHourlyWageUsd when no job held", () => {
    const s = fresh(); // activeJobId is null
    expect(s.activeJobId).toBeNull();
    // Work 40 hours, no hustle
    const before = s.cashUsd;
    const after = doStep(s, { hours: { work: 40, hustle: 0, rest: 60 } });
    const rent = CONFIG.cities.kingston.housingTiers[0]!.weeklyRentUsd;
    const living = CONFIG.cities.kingston.weeklyLivingCostUsd;
    const expected = round2(before + 40 * CONFIG.cities.kingston.baseHourlyWageUsd - rent - living);
    expect(after.cashUsd).toBe(expected);
  });

  it("earns job's hourlyWageUsd when a job is held", () => {
    const [withJob] = holdJob(fresh(), "full_time");
    expect(withJob.activeJobId).toBe("full_time");
    const before = withJob.cashUsd;
    const after = doStep(withJob, { hours: { work: 40, hustle: 0, rest: 60 } });
    const rent = CONFIG.cities.kingston.housingTiers[0]!.weeklyRentUsd;
    const living = CONFIG.cities.kingston.weeklyLivingCostUsd;
    const fullTimeWage = CONFIG.cities.kingston.jobs.find(j => j.id === "full_time")!.hourlyWageUsd;
    const expected = round2(before + 40 * fullTimeWage - rent - living);
    expect(after.cashUsd).toBe(expected);
  });

  it("earns skilled job's hourlyWageUsd when skilled job is held", () => {
    const [withJob] = holdJob(fresh(), "skilled");
    const before = withJob.cashUsd;
    const after = doStep(withJob, { hours: { work: 40, hustle: 0, rest: 60 } });
    const rent = CONFIG.cities.kingston.housingTiers[0]!.weeklyRentUsd;
    const living = CONFIG.cities.kingston.weeklyLivingCostUsd;
    const skilledWage = CONFIG.cities.kingston.jobs.find(j => j.id === "skilled")!.hourlyWageUsd;
    const expected = round2(before + 40 * skilledWage - rent - living);
    expect(after.cashUsd).toBe(expected);
  });
});

describe("under-hours tracking", () => {
  it("increments underHoursWeeks when work hours < lossThresholdHours", () => {
    const [withJob] = holdJob(fresh(), "part_time");
    // part_time lossThresholdHours = 15; work only 10 hours
    const after = doStep(withJob, { hours: { work: 10, hustle: 0, rest: 90 } });
    expect(after.underHoursWeeks).toBe(1);
  });

  it("resets underHoursWeeks to 0 when work hours >= lossThresholdHours", () => {
    let [withJob] = holdJob(fresh(), "part_time");
    // Start with some under-hours
    withJob = { ...withJob, underHoursWeeks: 1 };
    // Work at least 15 hours (threshold for part_time)
    const after = doStep(withJob, { hours: { work: 20, hustle: 0, rest: 80 } });
    expect(after.underHoursWeeks).toBe(0);
  });

  it("does not track under-hours for gig job (lossConsecutiveWeeks=0)", () => {
    const [withGig] = holdJob(fresh(), "gig");
    // Work 0 hours — gig should never accumulate under-hours
    const after = doStep(withGig, { hours: { work: 0, hustle: 10, rest: 90 } });
    // gig's lossConsecutiveWeeks is 0, so underHoursWeeks stays 0
    expect(after.underHoursWeeks).toBe(0);
    expect(after.activeJobId).toBe("gig");
  });
});

describe("job loss", () => {
  it("loses job after lossConsecutiveWeeks consecutive under-hours weeks", () => {
    // part_time: lossThresholdHours=15, lossConsecutiveWeeks=2
    let s = fresh();
    [s] = holdJob(s, "part_time");

    // Week 1: under hours (work < 15)
    s = doStep(s, { hours: { work: 10, hustle: 0, rest: 90 } });
    expect(s.underHoursWeeks).toBe(1);
    expect(s.activeJobId).toBe("part_time"); // not lost yet

    // Week 2: under hours again
    s = doStep(s, { hours: { work: 10, hustle: 0, rest: 90 } });
    expect(s.activeJobId).toBeNull(); // job lost
    expect(s.underHoursWeeks).toBe(0);
  });

  it("appends lost_job_<id> history tag when job is lost", () => {
    let s = fresh();
    [s] = holdJob(s, "part_time");
    s = doStep(s, { hours: { work: 10, hustle: 0, rest: 90 } });
    s = doStep(s, { hours: { work: 10, hustle: 0, rest: 90 } });

    const lostEntry = s.history.find(h => h.tags.includes("lost_job_part_time"));
    expect(lostEntry).toBeDefined();
  });

  it("reduces reputation by jobLossPenalty when job is lost", () => {
    let s = fresh();
    const repBefore = s.reputation;
    [s] = holdJob(s, "part_time");
    s = doStep(s, { hours: { work: 10, hustle: 0, rest: 90 } });
    s = doStep(s, { hours: { work: 10, hustle: 0, rest: 90 } });

    expect(s.reputation).toBe(Math.max(0, repBefore - CONFIG.reputation.jobLossPenalty));
  });

  it("reputation does not go below 0 on job loss", () => {
    let s = fresh();
    // Start with very low reputation
    s = { ...s, reputation: 2 };
    [s] = holdJob(s, "full_time");
    s = doStep(s, { hours: { work: 10, hustle: 0, rest: 90 } });
    s = doStep(s, { hours: { work: 10, hustle: 0, rest: 90 } });
    expect(s.reputation).toBeGreaterThanOrEqual(0);
  });

  it("falls back to gig rate after job loss", () => {
    let s = fresh();
    [s] = holdJob(s, "part_time");
    // Lose the job over 2 consecutive under-hours weeks
    s = doStep(s, { hours: { work: 10, hustle: 0, rest: 90 } });
    s = doStep(s, { hours: { work: 10, hustle: 0, rest: 90 } });
    expect(s.activeJobId).toBeNull();

    // Now work 40 hours; should earn baseHourlyWageUsd, not part_time rate
    const before = s.cashUsd;
    const after = doStep(s, { hours: { work: 40, hustle: 0, rest: 60 } });
    const rent = CONFIG.cities.kingston.housingTiers[after.housingTier]!.weeklyRentUsd;
    const living = CONFIG.cities.kingston.weeklyLivingCostUsd;
    const expected = round2(before + 40 * CONFIG.cities.kingston.baseHourlyWageUsd - rent - living);
    expect(after.cashUsd).toBe(expected);
  });

  it("does not lose gig job regardless of work hours", () => {
    let s = fresh();
    [s] = holdJob(s, "gig");
    // Work 0 hours for many weeks — gig should never be lost
    for (let i = 0; i < 10; i++) {
      s = doStep(s, { hours: { work: 0, hustle: 10, rest: 90 } });
    }
    expect(s.activeJobId).toBe("gig");
  });

  it("under-hours streak resets if adequate hours worked mid-streak", () => {
    let s = fresh();
    [s] = holdJob(s, "part_time");
    // Week 1: under hours
    s = doStep(s, { hours: { work: 10, hustle: 0, rest: 90 } });
    expect(s.underHoursWeeks).toBe(1);
    // Week 2: enough hours — streak resets
    s = doStep(s, { hours: { work: 20, hustle: 0, rest: 80 } });
    expect(s.underHoursWeeks).toBe(0);
    expect(s.activeJobId).toBe("part_time"); // still employed
    // Week 3: under hours again — only 1 consecutive week, no loss yet
    s = doStep(s, { hours: { work: 10, hustle: 0, rest: 90 } });
    expect(s.underHoursWeeks).toBe(1);
    expect(s.activeJobId).toBe("part_time");
  });
});

describe("validateInput hustle cap", () => {
  it("rejects hustle > 20 when holding full_time job", () => {
    const [withJob] = holdJob(fresh(), "full_time");
    const err = validateInput(withJob, { hours: { work: 40, hustle: 21, rest: 39 } });
    expect(err).toMatch(/hustle/i);
  });

  it("rejects hustle > 20 when holding skilled job", () => {
    const [withJob] = holdJob(fresh(), "skilled");
    const err = validateInput(withJob, { hours: { work: 40, hustle: 21, rest: 39 } });
    expect(err).toMatch(/hustle/i);
  });

  it("allows hustle <= 20 when holding full_time job", () => {
    const [withJob] = holdJob(fresh(), "full_time");
    const err = validateInput(withJob, { hours: { work: 40, hustle: 20, rest: 40 } });
    expect(err).toBeNull();
  });

  it("allows hustle > 20 when holding part_time job (minCommitHours < 40)", () => {
    const [withJob] = holdJob(fresh(), "part_time");
    const err = validateInput(withJob, { hours: { work: 20, hustle: 25, rest: 55 } });
    expect(err).toBeNull();
  });

  it("allows hustle > 20 when no job held", () => {
    const s = fresh();
    const err = validateInput(s, { hours: { work: 0, hustle: 50, rest: 50 } });
    expect(err).toBeNull();
  });
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
