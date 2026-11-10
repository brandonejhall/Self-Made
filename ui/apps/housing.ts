// SM-023: Housing app. Current tier and weekly cost, other tiers, move.
// Sim calls: moveHousing.

import { CONFIG, moveHousing } from "../../sim";
import { actionButton, card, h, kv, req, section, usd } from "./shared";
import type { AppContext, PhoneApp } from "./types";

function render(root: HTMLElement, ctx: AppContext): void {
  const state = ctx.getState();
  const city = CONFIG.cities[state.cityId];
  const tiers = city.housingTiers;
  const here = tiers[state.housingTier];

  const currentCard = card(
    h("div", { class: "app-card__title" }, `Tier ${state.housingTier}`),
    kv("Rent", `${usd(here?.weeklyRentUsd ?? 0)} / week`),
    kv("Living costs", `${usd(city.weeklyLivingCostUsd)} / week`),
    kv("Total", `${usd((here?.weeklyRentUsd ?? 0) + city.weeklyLivingCostUsd)} / week`),
    kv(
      "Weeks in arrears",
      `${state.overdueWeeks} of ${CONFIG.progression.evictionOverdueCount}`,
      state.overdueWeeks > 0 ? "kv__value--warn" : "",
    ),
    h(
      "div",
      { class: "app-note" },
      `Ending ${CONFIG.progression.evictionOverdueCount} weeks in a row below ${usd(CONFIG.progression.overdueCashFloor)} cash means eviction to Tier 0.`,
    ),
  );

  const others = tiers
    .map((tier, idx) => ({ tier, idx }))
    .filter(({ idx }) => idx !== state.housingTier)
    .map(({ tier, idx }) => {
      const [after, err] = moveHousing(state, idx);
      const rentChange = tier.weeklyRentUsd - (here?.weeklyRentUsd ?? 0);
      return card(
        h("div", { class: "app-card__title" }, `Tier ${idx}`),
        kv("Rent", `${usd(tier.weeklyRentUsd)} / week`),
        kv(
          "Change vs now",
          `${rentChange >= 0 ? "+" : "-"}${usd(Math.abs(rentChange))} / week`,
          rentChange > 0 ? "kv__value--warn" : "kv__value--good",
        ),
        kv("Deposit (paid on move)", usd(tier.depositUsd)),
        req(`Cash on hand ${usd(tier.cashRequiredUsd)}+ (you: ${usd(state.cashUsd)})`, state.cashUsd >= tier.cashRequiredUsd),
        req(`Cash for deposit ${usd(tier.depositUsd)}`, state.cashUsd >= tier.depositUsd),
        actionButton(ctx, {
          label: `Move to Tier ${idx}`,
          confirmLines: [
            ["Deposit paid now", usd(tier.depositUsd)],
            ["Cash after move", err ? "Blocked" : usd(after.cashUsd)],
            ["New rent", `${usd(tier.weeklyRentUsd)} / week`],
            ["Old rent", `${usd(here?.weeklyRentUsd ?? 0)} / week`],
          ],
          blockedReason: err,
          action: (s) => moveHousing(s, idx),
          successMessage: `You moved to Tier ${idx}.`,
        }),
      );
    });

  root.append(section("Where you live", currentCard), section("Other places", ...others));
}

export const housingApp: PhoneApp = {
  id: "housing",
  name: "Housing",
  icon: "H",
  render,
};
