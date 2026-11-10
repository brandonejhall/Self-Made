// SM-023: Business app. Owned businesses with weekly income, business types, launch.
// SM-021: Grow action per business.
// Sim calls: launchBusiness, reinvestBusiness, netWorthUsd.

import { CONFIG, launchBusiness, netWorthUsd, reinvestBusiness, type Asset, type GameState } from "../../sim";
import { actionButton, card, empty, h, kv, prettyId, req, section, usd } from "./shared";
import type { AppContext, PhoneApp } from "./types";

const BUSINESS_TYPE_IDS: ReadonlySet<string> = new Set(CONFIG.businesses.types.map((b) => b.id));

function ownedBusinesses(state: GameState): Asset[] {
  return state.assets.filter((a) => BUSINESS_TYPE_IDS.has(a.type));
}

// SM-021: Grow action. Shows stage progress and reinvests the remaining amount
// the next stage needs. The stage advance itself happens in step().
function renderGrowAction(ctx: AppContext, asset: Asset): HTMLElement {
  const state = ctx.getState();
  const stages = CONFIG.businesses.stages;
  const stage = asset.stage ?? 1;
  const cur = stages[stage - 1];
  const next = stages[stage];
  const lines: HTMLElement[] = [
    kv("Stage", `${stage} of ${stages.length}${cur ? ` (${cur.name})` : ""}`),
    kv("Income multiplier", `${cur?.incomeMult ?? 1}x`),
  ];
  if (!next) {
    lines.push(h("div", { class: "app-note" }, "Top stage reached. Nothing left to grow."));
    return h("div", { class: "grow" }, ...lines);
  }

  const weeks = asset.weeksAtStage ?? 0;
  const reinvested = asset.reinvestedAtStageUsd ?? 0;
  const remaining = Math.max(0, Math.round((next.reinvestToEnterUsd - reinvested) * 100) / 100);
  const base = CONFIG.businesses.types.find((b) => b.id === asset.type)?.weeklyIncomeUsd ?? 0;
  const weeksOk = weeks >= next.minWeeksToEnter;

  lines.push(
    kv(`Next: stage ${next.stage} (${next.name})`, `${next.incomeMult}x, ${usd(base * next.incomeMult)} / week`, "kv__value--good"),
    kv("Weeks at stage", `${weeks} of ${next.minWeeksToEnter}`, weeksOk ? "kv__value--good" : ""),
    kv("Reinvested", `${usd(reinvested)} of ${usd(next.reinvestToEnterUsd)}`, remaining === 0 ? "kv__value--good" : ""),
  );

  if (remaining === 0) {
    lines.push(
      h(
        "div",
        { class: "app-note" },
        weeksOk
          ? "Ready. The business grows when you advance the week."
          : `Fully funded. It grows after ${next.minWeeksToEnter - weeks} more weeks at this stage.`,
      ),
    );
    return h("div", { class: "grow" }, ...lines);
  }

  const [after, err] = reinvestBusiness(state, asset.id, remaining);
  lines.push(
    req(`Cash ${usd(remaining)}+ (you: ${usd(state.cashUsd)})`, state.cashUsd >= remaining),
    actionButton(ctx, {
      label: `Grow: reinvest ${usd(remaining)}`,
      confirmLines: [
        ["Reinvest now", usd(remaining)],
        ["Cash after", err ? "Blocked" : usd(after.cashUsd)],
        ["Weeks at stage", `${weeks} of ${next.minWeeksToEnter}`],
        ["Income after growth", `${usd(base * next.incomeMult)} / week`],
      ],
      blockedReason: err,
      action: (s) => reinvestBusiness(s, asset.id, remaining),
      successMessage: `Reinvested ${usd(remaining)} in ${prettyId(asset.type)}.`,
    }),
  );
  return h("div", { class: "grow" }, ...lines);
}

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
