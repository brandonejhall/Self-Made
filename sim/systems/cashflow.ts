// Cashflow: settles the week's income against housing, living, loan and property costs.

import { round2, type StepContext } from "../util";

export function cashflowSystem(ctx: StepContext): StepContext {
  const income = ctx.workHustleIncomeUsd + ctx.businessIncomeUsd + ctx.propertyRentUsd;
  const totalCosts = ctx.housingCostUsd + ctx.loanPaymentsUsd + ctx.propertyCostsUsd;
  const cashUsd = round2(ctx.prev.cashUsd + income - totalCosts);
  return { ...ctx, next: { ...ctx.next, cashUsd } };
}
