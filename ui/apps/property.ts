// ── PLACEHOLDER: Property app (SM-016) ───────────────────────────────────
// SM-016 adds buyProperty / sellProperty to the sim. When it merges, replace
// render() below with the real app, following ui/apps/housing.ts:
//   1. Import buyProperty, sellProperty from "../../sim".
//   2. "Your properties": each owned property with value, weekly income,
//      mortgage balance and weekly payment, plus a Sell actionButton.
//   3. "For sale": each listing with price, deposit, mortgage terms and weekly
//      net income, requirements via req(), and a Buy actionButton.
//   4. Dry-run each action for its error and post-action cash.
//   5. Remove `placeholder: true` below. ui/apps/index.ts already registers it.

import { card, empty, section } from "./shared";
import type { AppContext, PhoneApp } from "./types";

function render(root: HTMLElement, _ctx: AppContext): void {
  root.append(
    section("Property", card(empty("Property buying opens in a later update."))),
  );
}

export const propertyApp: PhoneApp = {
  id: "property",
  name: "Property",
  icon: "P",
  placeholder: true,
  render,
};
// ── END PLACEHOLDER ──────────────────────────────────────────────────────
