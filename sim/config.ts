// Every tunable number in the simulation lives here.
// The pm sets targets. balance-qa recommends changes. sim-engineer applies them.
// Placeholder values until the GDD defines the Stage 1 economy.

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
  },
  cities: {
    kingston: {
      weeklyRentUsd: 90,
      weeklyLivingCostUsd: 60,
      baseHourlyWageUsd: 3.5,
      hustleHourlyMinUsd: 0,
      hustleHourlyMaxUsd: 9,
    },
  },
} as const;

export type CityId = keyof typeof CONFIG.cities;
