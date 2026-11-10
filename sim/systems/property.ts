// Rental property (GDD 9.1): buy/sell actions and the weekly property system.
// Rent, maintenance, mortgage settlement, vacancy and appreciation all run here.
// Mortgages live in state.liabilities with kind "mortgage"; loanRepaymentSystem skips them.

import { CONFIG } from "../config";
import { nextRandom } from "../rng";
import type { Asset, GameState, HistoryEntry, Liability } from "../types";
import { round2, type StepContext } from "../util";

const P = CONFIG.property;

export function findPropertyType(typeId: string) {
  return P.types.find((t) => t.id === typeId);
}

export function isProperty(a: Asset): boolean {
  return a.kind === "property";
}

// GDD 7.4 amortization: weekly rate = APR / 52, rounded to the nearest cent.
export function mortgagePaymentUsd(principalUsd: number, aprPct: number, termWeeks: number): number {
  const r = aprPct / 52 / 100;
  if (r === 0) return round2(principalUsd / termWeeks);
  return Math.round(((principalUsd * r) / (1 - Math.pow(1 + r, -termWeeks))) * 100) / 100;
}

// Runs after businessIncomeSystem and before housingCostSystem.
// RNG: one nextRandom draw per owned property, in asset order. No property, no draw.
export function propertySystem(ctx: StepContext): StepContext {
  const owned = ctx.next.assets.filter(isProperty);
  if (owned.length === 0) return { ...ctx, propertyRentUsd: 0, propertyCostsUsd: 0 };

  const newWeek = ctx.prev.week + 1;
  let rngState = ctx.next.rngState;
  let rent = 0;
  let costs = 0;

  const assets = ctx.next.assets.map((a) => {
    if (!isProperty(a)) return a;
    let occupied = a.occupied ?? true;
    let vacantWeeksRemaining = a.vacantWeeksRemaining ?? 0;

    // A vacancy that has run its full length ends at the start of this week.
    if (!occupied && vacantWeeksRemaining <= 0) occupied = true;

    const [roll, nextRng] = nextRandom(rngState);
    rngState = nextRng;
    if (occupied && roll < P.vacancyChancePerWeek) {
      occupied = false;
      vacantWeeksRemaining = P.vacancyWeeks;
    }

    if (occupied) {
      rent += a.weeklyRentUsd ?? 0;
    } else {
      vacantWeeksRemaining -= 1;
    }

    costs += round2((a.bookValueUsd * P.maintenancePctPerYear) / CONFIG.time.weeksPerYear);

    const weeksOwned = newWeek - (a.purchaseWeek ?? 0);
    const bookValueUsd =
      weeksOwned > 0 && weeksOwned % CONFIG.time.weeksPerYear === 0
        ? round2(a.bookValueUsd * (1 + P.appreciationPctPerYear))
        : a.bookValueUsd;

    return { ...a, occupied, vacantWeeksRemaining, bookValueUsd };
  });

  const liabilities: Liability[] = [];
  for (const l of ctx.next.liabilities) {
    if (l.kind !== "mortgage") {
      liabilities.push(l);
      continue;
    }
    const interest = (l.principalUsd * (l.aprPct ?? P.mortgageAprPct)) / 100 / CONFIG.time.weeksPerYear;
    if (l.weeksRemaining <= 1 || l.principalUsd + interest <= l.weeklyPaymentUsd) {
      costs += round2(l.principalUsd + interest); // final payment clears any rounding remainder
      continue;
    }
    costs += l.weeklyPaymentUsd;
    liabilities.push({
      ...l,
      principalUsd: round2(l.principalUsd - (l.weeklyPaymentUsd - interest)),
      weeksRemaining: l.weeksRemaining - 1,
    });
  }

  return {
    ...ctx,
    propertyRentUsd: round2(rent),
    propertyCostsUsd: round2(costs),
    next: { ...ctx.next, assets, liabilities, rngState },
  };
}

export function buyProperty(
  state: GameState,
  propertyTypeId: string,
  downPaymentUsd: number,
  termWeeks: number,
): [GameState, string | null] {
  if (state.wealthTier < 1) {
    return [state, `Buying property requires Tier 1 (net worth >= $${CONFIG.progression.tier1Threshold})`];
  }
  const type = findPropertyType(propertyTypeId);
  if (!type) return [state, `Unknown property type: ${propertyTypeId}`];

  const price = type.priceUsd;
  const minDown = round2(price * P.minDownPaymentPct);
  if (downPaymentUsd < minDown) return [state, `Down payment must be at least $${minDown}`];
  if (downPaymentUsd > price) return [state, `Down payment cannot exceed the price $${price}`];

  const principal = round2(price - downPaymentUsd);
  const needsMortgage = principal > 0;
  const terms: readonly number[] = P.mortgageTermWeeksOptions;
  if (needsMortgage && !terms.includes(termWeeks)) {
    return [state, `Mortgage term must be one of ${terms.join(", ")} weeks`];
  }

  const closing = round2(price * P.closingCostPct);
  const cashNeeded = round2(downPaymentUsd + closing);
  if (state.cashUsd < cashNeeded) return [state, `Need $${cashNeeded} for down payment and closing`];

  if (state.assets.filter(isProperty).length >= P.maxOwned) {
    return [state, `Cannot own more than ${P.maxOwned} properties`];
  }

  const assetId = `prop_${propertyTypeId}_${state.week}_${state.history.length}`;
  const asset: Asset = {
    id: assetId,
    type: propertyTypeId,
    kind: "property",
    bookValueUsd: price,
    weeklyRentUsd: type.weeklyRentUsd,
    occupied: true,
    vacantWeeksRemaining: 0,
    purchaseWeek: state.week,
  };

  const liabilities: Liability[] = needsMortgage
    ? [
        ...state.liabilities,
        {
          id: `mortgage_${assetId}`,
          kind: "mortgage",
          propertyId: assetId,
          aprPct: P.mortgageAprPct,
          principalUsd: principal,
          weeklyPaymentUsd: mortgagePaymentUsd(principal, P.mortgageAprPct, termWeeks),
          weeksRemaining: termWeeks,
        },
      ]
    : state.liabilities;

  const entry: HistoryEntry = {
    week: state.week,
    action: `bought_property_${propertyTypeId}`,
    tags: [`bought_${propertyTypeId}`, ...(needsMortgage ? ["took_mortgage"] : [])],
  };

  return [
    {
      ...state,
      cashUsd: round2(state.cashUsd - cashNeeded),
      assets: [...state.assets, asset],
      liabilities,
      history: [...state.history, entry],
    },
    null,
  ];
}

export function sellProperty(state: GameState, assetId: string): [GameState, string | null] {
  const asset = state.assets.find((a) => a.id === assetId);
  if (!asset) return [state, `Unknown asset id: ${assetId}`];
  if (!isProperty(asset)) return [state, `Asset ${assetId} is not a property`];

  const remaining = state.liabilities
    .filter((l) => l.kind === "mortgage" && l.propertyId === assetId)
    .reduce((sum, l) => sum + l.principalUsd, 0);
  const proceeds = round2(asset.bookValueUsd * (1 - P.sellingCostPct) - remaining);

  return [
    {
      ...state,
      cashUsd: round2(state.cashUsd + proceeds),
      assets: state.assets.filter((a) => a.id !== assetId),
      liabilities: state.liabilities.filter(
        (l) => !(l.kind === "mortgage" && l.propertyId === assetId),
      ),
      history: [
        ...state.history,
        { week: state.week, action: `sold_property_${asset.type}`, tags: ["sold_property"] },
      ],
    },
    null,
  ];
}
