import { describe, expect, it } from "vitest";
import { CONFIG } from "../../sim";

describe("SM-002: Stage 1 config", () => {
  it("CONFIG.energy.studyCostPerHour equals 0.3", () => {
    expect(CONFIG.energy.studyCostPerHour).toBe(0.3);
  });

  it("CONFIG.energy.burnoutThreshold equals 20", () => {
    expect(CONFIG.energy.burnoutThreshold).toBe(20);
  });

  it("CONFIG.cities.kingston.housingTiers has exactly 5 entries", () => {
    expect(CONFIG.cities.kingston.housingTiers).toHaveLength(5);
  });

  it("tier 0 rent is 90", () => {
    expect(CONFIG.cities.kingston.housingTiers[0].weeklyRentUsd).toBe(90);
  });

  it("tier 4 rent is 0", () => {
    expect(CONFIG.cities.kingston.housingTiers[4].weeklyRentUsd).toBe(0);
  });

  it("CONFIG.cities.kingston.jobs has exactly 4 entries", () => {
    expect(CONFIG.cities.kingston.jobs).toHaveLength(4);
  });

  it("gig job wage is 3.50", () => {
    const gig = CONFIG.cities.kingston.jobs.find((j) => j.id === "gig");
    expect(gig).toBeDefined();
    expect(gig!.hourlyWageUsd).toBe(3.5);
  });

  it("skilled job wage is 12.00", () => {
    const skilled = CONFIG.cities.kingston.jobs.find((j) => j.id === "skilled");
    expect(skilled).toBeDefined();
    expect(skilled!.hourlyWageUsd).toBe(12.0);
  });

  it("CONFIG.loans.baseAprPct equals 18", () => {
    expect(CONFIG.loans.baseAprPct).toBe(18);
  });

  it("CONFIG.loans.minAprPct equals 4", () => {
    expect(CONFIG.loans.minAprPct).toBe(4);
  });

  it("CONFIG.businesses.types has exactly 4 entries", () => {
    expect(CONFIG.businesses.types).toHaveLength(4);
  });

  it("food stall launch cost is 2000", () => {
    const foodStall = CONFIG.businesses.types.find((b) => b.id === "food_stall");
    expect(foodStall).toBeDefined();
    expect(foodStall!.launchCostUsd).toBe(2000);
  });

  it("CONFIG.progression.tier1Threshold equals 10000", () => {
    expect(CONFIG.progression.tier1Threshold).toBe(10000);
  });

  it("CONFIG.progression.tier2Threshold equals 1000000", () => {
    expect(CONFIG.progression.tier2Threshold).toBe(1000000);
  });

  it("CONFIG.events.maxPerWeek equals 2", () => {
    expect(CONFIG.events.maxPerWeek).toBe(2);
  });
});
