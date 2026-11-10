// SM-021: Property app. Owned rentals with occupancy and mortgage, listings with
// down payment and term choice, buy and sell.
// Sim calls: buyProperty, sellProperty, mortgagePaymentUsd, netWorthUsd.

import {
  CONFIG,
  buyProperty,
  mortgagePaymentUsd,
  netWorthUsd,
  sellProperty,
  type Asset,
  type GameState,
  type Liability,
} from "../../sim";
import { actionButton, card, empty, h, kv, prettyId, req, section, usd } from "./shared";
import type { AppContext, PhoneApp } from "./types";

const P = CONFIG.property;
const DOWN_OPTIONS: readonly number[] = [P.minDownPaymentPct, 0.5, 1];
const TERMS: readonly number[] = P.mortgageTermWeeksOptions;

// UI-only selection per listing. Never a game outcome.
const choice: Record<string, { downPct: number; termWeeks: number }> = {};

function selection(typeId: string): { downPct: number; termWeeks: number } {
  return (choice[typeId] ??= { downPct: P.minDownPaymentPct, termWeeks: TERMS[0]! });
}

function pctLabel(p: number): string {
  return `${Math.round(p * 100)}%`;
}

function weeksLabel(w: number): string {
  return `${w} weeks (${Math.round(w / CONFIG.time.weeksPerYear)} years)`;
}

function ownedProperties(state: GameState): Asset[] {
  return state.assets.filter((a) => a.kind === "property");
}

function mortgageFor(state: GameState, assetId: string): Liability | undefined {
  return state.liabilities.find((l) => l.kind === "mortgage" && l.propertyId === assetId);
}

/** Row of toggle buttons. Re-renders the app through onPick. */
function toggles<T>(
  options: readonly T[],
  current: T,
  label: (o: T) => string,
  onPick: (o: T) => void,
): HTMLElement {
  const row = h("div", { class: "toggle-row" });
  for (const o of options) {
    const btn = h(
      "button",
      { class: `toggle${o === current ? " toggle--on" : ""}`, "aria-pressed": String(o === current) },
      label(o),
    );
    btn.addEventListener("click", () => onPick(o));
    row.append(btn);
  }
  return row;
}

function renderOwned(ctx: AppContext, state: GameState, a: Asset): HTMLElement {
  const m = mortgageFor(state, a.id);
  const occupied = a.occupied ?? true;
  const [after, err] = sellProperty(state, a.id);
  const proceeds = err ? null : after.cashUsd - state.cashUsd;
  const maintenance = (a.bookValueUsd * P.maintenancePctPerYear) / CONFIG.time.weeksPerYear;

  return card(
    h("div", { class: "app-card__title" }, prettyId(a.type)),
    kv("Book value", usd(a.bookValueUsd)),
    kv("Rent", `${usd(a.weeklyRentUsd ?? 0)} / week`, occupied ? "kv__value--good" : ""),
    kv(
      "Status",
      occupied ? "Occupied" : `Vacant, ${a.vacantWeeksRemaining ?? 0} weeks left`,
      occupied ? "kv__value--good" : "kv__value--warn",
    ),
    kv("Maintenance", `${usd(maintenance)} / week`),
    m
      ? kv("Mortgage principal", usd(m.principalUsd), "kv__value--warn")
      : kv("Mortgage", "None (owned outright)"),
    m ? kv("Mortgage payment", `${usd(m.weeklyPaymentUsd)} / week`) : null,
    m ? kv("Mortgage weeks left", String(m.weeksRemaining)) : null,
    actionButton(ctx, {
      label: `Sell ${prettyId(a.type)}`,
      secondary: true,
      confirmLines: [
        ["Book value", usd(a.bookValueUsd)],
        [`Selling cost (${pctLabel(P.sellingCostPct)})`, usd(a.bookValueUsd * P.sellingCostPct)],
        ["Mortgage paid off", usd(m?.principalUsd ?? 0)],
        ["Sale proceeds", proceeds === null ? "Blocked" : usd(proceeds)],
        ["Cash after sale", err ? "Blocked" : usd(after.cashUsd)],
        ["Rent lost", `${usd(a.weeklyRentUsd ?? 0)} / week`],
      ],
      blockedReason: err,
      action: (s) => sellProperty(s, a.id),
      successMessage: `${prettyId(a.type)} sold.`,
    }),
  );
}

function renderListing(
  ctx: AppContext,
  state: GameState,
  type: (typeof P.types)[number],
  rerender: () => void,
): HTMLElement {
  const sel = selection(type.id);
  const price = type.priceUsd;
  const minDown = price * P.minDownPaymentPct;
  const closing = price * P.closingCostPct;
  const down = Math.round(price * sel.downPct * 100) / 100;
  const principal = price - down;
  const needsMortgage = principal > 0;
  const [after, err] = buyProperty(state, type.id, down, sel.termWeeks);
  const weekly = needsMortgage ? mortgagePaymentUsd(principal, P.mortgageAprPct, sel.termWeeks) : 0;
  const maintenance = (price * P.maintenancePctPerYear) / CONFIG.time.weeksPerYear;
  const net = type.weeklyRentUsd - weekly - maintenance;
  const owned = ownedProperties(state).length;

  const termLines = needsMortgage
    ? TERMS.map((t) =>
        kv(`Payment, ${t} weeks`, `${usd(mortgagePaymentUsd(principal, P.mortgageAprPct, t))} / week`),
      )
    : [kv("Mortgage", "None at 100% down")];

  return card(
    h("div", { class: "app-card__title" }, prettyId(type.id)),
    kv("Price", usd(price)),
    kv("Rent when occupied", `${usd(type.weeklyRentUsd)} / week`, "kv__value--good"),
    kv(`Minimum down (${pctLabel(P.minDownPaymentPct)})`, usd(minDown)),
    kv(`Closing cost (${pctLabel(P.closingCostPct)})`, usd(closing)),
    kv("Mortgage APR", `${P.mortgageAprPct}%`),
    h("span", { class: "stat-label" }, "Down payment"),
    toggles(DOWN_OPTIONS, sel.downPct, pctLabel, (o) => {
      sel.downPct = o;
      rerender();
    }),
    needsMortgage ? h("span", { class: "stat-label" }, "Mortgage term") : null,
    needsMortgage
      ? toggles(TERMS, sel.termWeeks, (t) => `${t} wk`, (t) => {
          sel.termWeeks = t;
          rerender();
        })
      : null,
    kv("Down payment", usd(down)),
    kv("Cash needed now", usd(down + closing)),
    kv("Mortgage principal", usd(principal)),
    ...termLines,
    kv("Maintenance", `${usd(maintenance)} / week`),
    kv(
      "Net after mortgage, upkeep",
      `${net >= 0 ? "+" : "-"}${usd(Math.abs(net))} / week`,
      net >= 0 ? "kv__value--good" : "kv__value--warn",
    ),
    kv("Cash after purchase", err ? "Blocked" : usd(after.cashUsd), err ? "kv__value--warn" : ""),
    req(
      `Tier 1: net worth ${usd(CONFIG.progression.tier1Threshold)}+ (you: ${usd(netWorthUsd(state))})`,
      state.wealthTier >= 1,
    ),
    req(`Cash ${usd(down + closing)}+ (you: ${usd(state.cashUsd)})`, state.cashUsd >= down + closing),
    req(`A free property slot (${owned} of ${P.maxOwned} used)`, owned < P.maxOwned),
    actionButton(ctx, {
      label: `Buy ${prettyId(type.id)}`,
      confirmLines: [
        ["Price", usd(price)],
        [`Down payment (${pctLabel(sel.downPct)})`, usd(down)],
        ["Closing cost", usd(closing)],
        ["Cash after purchase", err ? "Blocked" : usd(after.cashUsd)],
        ["Mortgage principal", usd(principal)],
        ["Mortgage term", needsMortgage ? weeksLabel(sel.termWeeks) : "None"],
        ["Mortgage payment", `${usd(weekly)} / week`],
        ["Rent when occupied", `${usd(type.weeklyRentUsd)} / week`],
      ],
      blockedReason: err,
      action: (s) => buyProperty(s, type.id, down, sel.termWeeks),
      successMessage: `${prettyId(type.id)} bought.`,
    }),
  );
}

function render(root: HTMLElement, ctx: AppContext): void {
  const state = ctx.getState();
  const owned = ownedProperties(state);
  const rerender = (): void => {
    root.replaceChildren();
    render(root, ctx);
  };

  const rent = owned.reduce((sum, a) => sum + ((a.occupied ?? true) ? (a.weeklyRentUsd ?? 0) : 0), 0);
  const mortgagePay = state.liabilities
    .filter((l) => l.kind === "mortgage")
    .reduce((sum, l) => sum + l.weeklyPaymentUsd, 0);
  const mortgageOwed = state.liabilities
    .filter((l) => l.kind === "mortgage")
    .reduce((sum, l) => sum + l.principalUsd, 0);

  const overview = card(
    kv("Properties", `${owned.length} of ${P.maxOwned}`),
    kv("Rent collected", `${usd(rent)} / week`, rent > 0 ? "kv__value--good" : ""),
    kv("Mortgage payments", `${usd(mortgagePay)} / week`),
    kv("Mortgage owed", usd(mortgageOwed)),
    h(
      "div",
      { class: "app-note" },
      `Tenants leave now and then. A vacancy lasts ${P.vacancyWeeks} weeks with no rent. Values rise ${pctLabel(P.appreciationPctPerYear)} on each purchase anniversary.`,
    ),
  );

  root.append(
    section("Overview", overview),
    section(
      "Your properties",
      ...(owned.length ? owned.map((a) => renderOwned(ctx, state, a)) : [empty("You own no property yet.")]),
    ),
    section("For sale", ...P.types.map((t) => renderListing(ctx, state, t, rerender))),
  );
}

export const propertyApp: PhoneApp = {
  id: "property",
  name: "Property",
  icon: "P",
  render,
};
