// Cashflow: settles the week's income against housing, living and loan costs.

import { round2, type StepContext } from "../util";

export function cashflowSystem(ctx: StepContext): StepContext {
  const income = ctx.workHustleIncomeUsd + ctx.businessIncomeUsd;
  const totalCosts = ctx.housingCostUsd + ctx.loanPaymentsUsd;
  const cashUsd = round2(ctx.prev.cashUsd + income - totalCosts);
  return { ...ctx, next: { ...ctx.next, cashUsd } };
}
