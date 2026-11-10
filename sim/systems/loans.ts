// Loans: take-loan action, APR, and weekly repayment.

import { CONFIG } from "../config";
import type { GameState, HistoryEntry, Liability } from "../types";
import { round2, type StepContext } from "../util";

export function loanRepaymentSystem(ctx: StepContext): StepContext {
  let loanPaymentsUsd = 0;
  const updated = ctx.prev.liabilities.map((l) => {
    loanPaymentsUsd += l.weeklyPaymentUsd;
    return { ...l, weeksRemaining: l.weeksRemaining - 1 };
  });
  const liabilities = updated.filter((l) => l.weeksRemaining > 0);
  return { ...ctx, loanPaymentsUsd, next: { ...ctx.next, liabilities } };
}

export function effectiveLoanApr(state: GameState): number {
  const reduction = (state.skills["negotiation"] ?? 0) * CONFIG.loans.aprReductionPerSkillPoint;
  return Math.max(CONFIG.loans.baseAprPct - reduction, CONFIG.loans.minAprPct);
}

export function takeLoan(
  state: GameState,
  amount: number,
  termWeeks: number,
): [GameState, string | null] {
  // Eligibility: reputation must be >= CONFIG.loans.minReputation
  // UNLESS cash <= CONFIG.loans.emergencyMinCash (emergency override)
  const isEmergency = state.cashUsd <= CONFIG.loans.emergencyMinCash;
  if (!isEmergency && state.reputation < CONFIG.loans.minReputation) {
    return [
      state,
      `Reputation ${state.reputation} below minimum ${CONFIG.loans.minReputation}`,
    ];
  }

  // Max simultaneous loans check
  const maxLoans = CONFIG.loans.maxSimultaneous[state.wealthTier] ?? 1;
  if (state.liabilities.length >= maxLoans) {
    return [
      state,
      `Cannot hold more than ${maxLoans} simultaneous loans at tier ${state.wealthTier}`,
    ];
  }

  // Compute weekly payment using amortization formula
  const apr = effectiveLoanApr(state);
  const weeklyRate = apr / 52 / 100;
  let weeklyPayment: number;
  if (weeklyRate === 0) {
    weeklyPayment = Math.round((amount / termWeeks) * 100) / 100;
  } else {
    weeklyPayment =
      Math.round(
        ((amount * weeklyRate) / (1 - Math.pow(1 + weeklyRate, -termWeeks))) * 100,
      ) / 100;
  }

  const liability: Liability = {
    id: `loan_${state.week}_${amount}`,
    principalUsd: amount,
    weeklyPaymentUsd: weeklyPayment,
    weeksRemaining: termWeeks,
  };

  const newHistory: HistoryEntry[] = [
    ...state.history,
    { week: state.week, action: `took_loan_${amount}`, tags: ["took_loan"] },
  ];

  return [
    {
      ...state,
      cashUsd: round2(state.cashUsd + amount),
      liabilities: [...state.liabilities, liability],
      history: newHistory,
    },
    null,
  ];
}
