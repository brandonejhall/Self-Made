// SM-023: Business app. Owned businesses with weekly income, business types, launch.
// Sim calls: launchBusiness, netWorthUsd.

import { CONFIG, launchBusiness, netWorthUsd, type Asset, type GameState } from "../../sim";
import { actionButton, card, empty, h, kv, prettyId, req, section, usd } from "./shared";
import type { AppContext, PhoneApp } from "./types";

const BUSINESS_TYPE_IDS: ReadonlySet<string> = new Set(CONFIG.businesses.types.map((b) => b.id));

function ownedBusinesses(state: GameState): Asset[] {
  return state.assets.filter((a) => BUSINESS_TYPE_IDS.has(a.type));
}

// ── PLACEHOLDER: Grow action (SM-017) ────────────────────────────────────
// SM-017 adds business reinvest / stage advance to the sim. When it merges:
// import the sim's grow function from "../../sim", dry-run it here for the
// cost, new weekly income and any requirement, and return an actionButton(...)
// in place of the disabled button below. Nothing else in this file changes.
function renderGrowAction(_ctx: AppContext, _asset: Asset): HTMLElement {
  const btn = h("button", { class: "btn-secondary", disabled: "" }, "Grow (coming soon)");
  return h("div", { class: "action action--placeholder", "data-placeholder": "SM-017" }, btn);
}
// ── END PLACEHOLDER ──────────────────────────────────────────────────────

function render(root: HTMLElement, ctx: AppContext): void {
  const state = ctx.getState();
  const owned = ownedBusinesses(state);
  const totalIncome = owned.reduce((sum, a) => sum + (a.weeklyIncomeUsd ?? 0), 0);
  const financial = state.skills["financial"] ?? 0;
  const needFinancial = CONFIG.skills.financialBusinessUnlockLevel;
  const tierOk = state.wealthTier >= 1;
  const skillOk = Boolean(state.flags["skill_financial_unlocked"]);

  const summary = card(
    kv("Businesses", String(owned.length)),
    kv("Income", `${usd(totalIncome)} / week`, totalIncome > 0 ? "kv__value--good" : ""),
  );

  const ownedCards = owned.map((a) =>
    card(
      h("div", { class: "app-card__title" }, prettyId(a.type)),
      kv("Income", `${usd(a.weeklyIncomeUsd ?? 0)} / week`),
      kv("Book value", usd(a.bookValueUsd)),
      renderGrowAction(ctx, a),
    ),
  );

  const unlockCard = card(
    req(
      `Tier 1: net worth ${usd(CONFIG.progression.tier1Threshold)}+ (you: ${usd(netWorthUsd(state))})`,
      tierOk,
    ),
    req(`Financial skill ${needFinancial}+ (you: ${financial})`, skillOk),
    tierOk && skillOk
      ? null
      : h("div", { class: "app-note" }, "Study Financial in the week planner to raise the skill."),
  );

  const typeCards = CONFIG.businesses.types.map((biz) => {
    const [after, err] = launchBusiness(state, biz.id);
    return card(
      h("div", { class: "app-card__title" }, prettyId(biz.id)),
      kv("Sector", prettyId(biz.sector)),
      kv("Launch cost", usd(biz.launchCostUsd)),
      kv("Income", `${usd(biz.weeklyIncomeUsd)} / week`, "kv__value--good"),
      req(`Cash ${usd(biz.launchCostUsd)}+ (you: ${usd(state.cashUsd)})`, state.cashUsd >= biz.launchCostUsd),
      actionButton(ctx, {
        label: `Launch ${prettyId(biz.id)}`,
        confirmLines: [
          ["Launch cost", usd(biz.launchCostUsd)],
          ["Cash after launch", err ? "Blocked" : usd(after.cashUsd)],
          ["Income", `${usd(biz.weeklyIncomeUsd)} / week`],
        ],
        blockedReason: err,
        action: (s) => launchBusiness(s, biz.id),
        successMessage: `${prettyId(biz.id)} launched.`,
      }),
    );
  });

  root.append(
    section("Overview", summary),
    section("Your businesses", ...(ownedCards.length ? ownedCards : [empty("You own no businesses yet.")])),
    section("Requirements to launch", unlockCard),
    section("Start a business", ...typeCards),
  );
}

export const businessApp: PhoneApp = {
  id: "business",
  name: "Business",
  icon: "B",
  render,
};
