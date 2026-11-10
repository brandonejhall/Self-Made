// SM-023: Bank app. Balance, loans held, borrowing cap, loan offers, take a loan.
// Sim calls: takeLoan, effectiveLoanApr, netWorthUsd.

import { CONFIG, effectiveLoanApr, netWorthUsd, takeLoan, type GameState, type Liability } from "../../sim";
import { actionButton, card, empty, h, kv, req, section, usd, usd0 } from "./shared";
import type { AppContext, PhoneApp, SimAction } from "./types";

function loanCap(state: GameState): number {
  return CONFIG.loans.maxSimultaneous[state.wealthTier] ?? 1;
}

function pct(n: number): string {
  return `${n.toFixed(2)}%`;
}

function loanLabel(l: Liability): string {
  if (l.id.startsWith("eviction_repay")) return "Back-rent repayment (eviction)";
  return "Loan";
}

// Weekly payment the sim would set for this offer. The probe state clears the
// eligibility blockers so the price is visible even when the offer is blocked;
// the price depends only on amount, term and the player's APR.
function quotedPayment(state: GameState, amount: number, termWeeks: number): number | null {
  const probe: GameState = {
    ...state,
    reputation: Math.max(state.reputation, CONFIG.loans.minReputation),
    liabilities: [],
  };
  const [next, err] = takeLoan(probe, amount, termWeeks);
  if (err) return null;
  return next.liabilities[next.liabilities.length - 1]?.weeklyPaymentUsd ?? null;
}

function render(root: HTMLElement, ctx: AppContext): void {
  const state = ctx.getState();
  const apr = effectiveLoanApr(state);
  const cap = loanCap(state);
  const held = state.liabilities.length;
  const weeklyDebt = state.liabilities.reduce((sum, l) => sum + l.weeklyPaymentUsd, 0);
  const isEmergency = state.cashUsd <= CONFIG.loans.emergencyMinCash;

  // ── Balance ──
  const balance = card(
    kv("Cash", usd(state.cashUsd), state.cashUsd < 0 ? "kv__value--warn" : ""),
    kv("Net worth", usd(netWorthUsd(state))),
    kv("Debt payments", `${usd(weeklyDebt)} / week`),
  );

  // ── Loans held ──
  const loans = state.liabilities.map((l) => {
    const meta = ctx.meta.loans[l.id];
    return card(
      h("div", { class: "app-card__title" }, loanLabel(l)),
      kv("Principal", usd(l.principalUsd)),
      kv("APR", meta ? pct(meta.aprPct) : "Not recorded"),
      kv("Weekly payment", usd(l.weeklyPaymentUsd)),
      kv("Weeks left", meta ? `${l.weeksRemaining} of ${meta.termWeeks}` : String(l.weeksRemaining)),
    );
  });

  // ── Borrowing cap ──
  const capLines = Object.entries(CONFIG.loans.maxSimultaneous).map(([tier, n]) =>
    kv(`Tier ${tier}${Number(tier) === state.wealthTier ? " (you)" : ""}`, `${n} loan${n === 1 ? "" : "s"}`),
  );
  const capCard = card(
    kv("Loans held", `${held} of ${cap}`, held >= cap ? "kv__value--warn" : ""),
    kv("Your APR", pct(apr)),
    kv("Negotiation skill", String(state.skills["negotiation"] ?? 0)),
    req(
      `Reputation ${CONFIG.loans.minReputation}+ (you: ${state.reputation})` +
        (isEmergency ? ", waived: cash at emergency level" : ""),
      isEmergency || state.reputation >= CONFIG.loans.minReputation,
    ),
    req(`A free loan slot (${held} of ${cap} used)`, held < cap),
    h("div", { class: "app-note" }, "Back-rent repayments count toward the cap. Study Negotiation to lower your APR."),
    ...capLines,
  );

  // ── Offers ──
  const offers: HTMLElement[] = [];
  for (const amount of CONFIG.loans.amountTiers) {
    for (const termWeeks of CONFIG.loans.termWeeksOptions) {
      const [, err] = takeLoan(state, amount, termWeeks);
      const weekly = quotedPayment(state, amount, termWeeks);
      const total = weekly === null ? null : weekly * termWeeks;
      const action: SimAction = (s) => {
        const result = takeLoan(s, amount, termWeeks);
        const [next, e] = result;
        if (!e) {
          const added = next.liabilities[next.liabilities.length - 1];
          if (added) ctx.meta.loans[added.id] = { aprPct: effectiveLoanApr(s), termWeeks };
        }
        return result;
      };
      offers.push(
        card(
          h("div", { class: "app-card__title" }, `${usd0(amount)} over ${termWeeks} weeks`),
          kv("APR", pct(apr)),
          kv("Weekly payment", weekly === null ? "Unavailable" : usd(weekly)),
          kv("Total repaid", total === null ? "Unavailable" : usd(total)),
          actionButton(ctx, {
            label: "Take loan",
            confirmLines: [
              ["Cash now", usd(state.cashUsd)],
              ["You receive", usd(amount)],
              ["APR", pct(apr)],
              ["Weekly payment", weekly === null ? "Unavailable" : usd(weekly)],
              ["Weeks", String(termWeeks)],
              ["Total repaid", total === null ? "Unavailable" : usd(total)],
            ],
            blockedReason: err,
            action,
            successMessage: `Loan of ${usd0(amount)} deposited.`,
          }),
        ),
      );
    }
  }

  root.append(
    section("Account", balance),
    section("Loans held", ...(loans.length ? loans : [empty("No loans.")])),
    section("Borrowing", capCard),
    section("Loan offers", ...offers),
  );
}

export const bankApp: PhoneApp = {
  id: "bank",
  name: "Bank",
  icon: "$",
  render,
};
