// Every tunable number in the simulation lives here.
// The pm sets targets. balance-qa recommends changes. sim-engineer applies them.

export const CONFIG = {
  start: {
    year: 2026,
    age: 21,
    cashUsd: 2000,
    energy: 70,
    reputation: 10,
  },
  time: {
    weeksPerYear: 52,
    hoursPerWeek: 100,
  },
  energy: {
    max: 100,
    restRecoveryPerHour: 0.6,
    workCostPerHour: 0.5,
    hustleCostPerHour: 0.8,
    studyCostPerHour: 0.3,
    sideProjectCostPerHour: 0.7,
    burnoutThreshold: 20,
    burnoutProductivityMult: 0.5,
    burnoutActiveThreshold: 0,
    burnoutClearThreshold: 50,
    burnoutMaxHours: 40,
    burnoutRecoveryMult: 0.5,
  },
  cities: {
    kingston: {
      weeklyLivingCostUsd: 60,
      baseHourlyWageUsd: 3.5,
      hustleHourlyMinUsd: 0,
      hustleHourlyMaxUsd: 9,
      hustleSkillCeilingPerPoint: 0.5,
      hustleAbsoluteCeiling: 25,
      housingTiers: [
        { weeklyRentUsd: 90,  depositUsd: 0,    cashRequiredUsd: 0 },
        { weeklyRentUsd: 140, depositUsd: 280,  cashRequiredUsd: 500 },
        { weeklyRentUsd: 220, depositUsd: 660,  cashRequiredUsd: 1500 },
        { weeklyRentUsd: 320, depositUsd: 960,  cashRequiredUsd: 5000 },
        { weeklyRentUsd: 0,   depositUsd: 10000, cashRequiredUsd: 20000 },
      ],
      jobs: [
        { id: "gig",       minCommitHours: 0,  hourlyWageUsd: 3.50,  lossThresholdHours: 0,  lossConsecutiveWeeks: 0 },
        { id: "part_time", minCommitHours: 20, hourlyWageUsd: 5.00,  lossThresholdHours: 15, lossConsecutiveWeeks: 2 },
        { id: "full_time", minCommitHours: 40, hourlyWageUsd: 7.00,  lossThresholdHours: 30, lossConsecutiveWeeks: 2 },
        { id: "skilled",   minCommitHours: 40, hourlyWageUsd: 12.00, lossThresholdHours: 30, lossConsecutiveWeeks: 2 },
      ],
    },
  },
  loans: {
    baseAprPct: 18,
    minAprPct: 4,
    aprReductionPerSkillPoint: 0.25,
    amountTiers: [500, 1000, 2500, 5000],
    termWeeksOptions: [26, 52],
    maxSimultaneous: { 0: 1, 1: 2, 2: 3 } as Record<number, number>,
    minReputation: 15,
    emergencyMinCash: -2000,
  },
  businesses: {
    types: [
      { id: "food_stall",        launchCostUsd: 2000, weeklyIncomeUsd: 180, sector: "food" },
      { id: "delivery_service",  launchCostUsd: 3500, weeklyIncomeUsd: 260, sector: "logistics" },
      { id: "short_term_rental", launchCostUsd: 1500, weeklyIncomeUsd: 220, sector: "rental" },
      { id: "content_brand",     launchCostUsd: 500,  weeklyIncomeUsd: 80,  sector: "content" },
    ],
    // GDD 8.4. Index 0 is stage 1. minWeeksToEnter and reinvestToEnterUsd are measured at the previous stage.
    stages: [
      { stage: 1, name: "Startup",     incomeMult: 1, minWeeksToEnter: 0,  reinvestToEnterUsd: 0,     weeklyFailureChance: 0.003 },
      { stage: 2, name: "Established", incomeMult: 2, minWeeksToEnter: 26, reinvestToEnterUsd: 5000,  weeklyFailureChance: 0.0015 },
      { stage: 3, name: "Growing",     incomeMult: 4, minWeeksToEnter: 52, reinvestToEnterUsd: 20000, weeklyFailureChance: 0.001 },
      { stage: 4, name: "Scaled",      incomeMult: 8, minWeeksToEnter: 78, reinvestToEnterUsd: 60000, weeklyFailureChance: 0.0005 },
    ],
    burnoutFailureMult: 2,
    failureReputationPenalty: 5,
  },
  property: {
    types: [
      { id: "kgn_studio",  priceUsd: 30000,  weeklyRentUsd: 60 },
      { id: "kgn_two_bed", priceUsd: 65000,  weeklyRentUsd: 120 },
      { id: "kgn_house",   priceUsd: 150000, weeklyRentUsd: 260 },
    ],
    maxOwned: 3,
    minDownPaymentPct: 0.2,
    closingCostPct: 0.03,
    mortgageAprPct: 9,
    mortgageTermWeeksOptions: [520, 1040],
    maintenancePctPerYear: 0.01,
    vacancyChancePerWeek: 0.015,
    vacancyWeeks: 6,
    appreciationPctPerYear: 0.04,
    sellingCostPct: 0.05,
  },
  skills: {
    hustleWageCeilingPerPoint: 0.5,
    negotiationAprReductionPerPoint: 0.25,
    financialBusinessUnlockLevel: 3,
  },
  reputation: {
    hustleBonus: 0.01,
    hustlePenalty: 0.005,
    jobLossPenalty: 5,
  },
  progression: {
    tier1Threshold: 10000,
    tier2Threshold: 1000000,
    overdueCashFloor: 0,
    evictionOverdueCount: 2,
    evictionForcedRepayPerWeek: 20,
  },
  events: {
    maxPerWeek: 2,
    defaultWeight: 10,
  },
} as const;

export type CityId = keyof typeof CONFIG.cities;
