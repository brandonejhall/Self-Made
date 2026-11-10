# Game Design Document: Self Made — Stage 1 (Hustle)

Owned by the pm agent. Source of truth for the Stage 1 vertical slice.
Last updated: 2026-11-09 (T3 counts major delayed consequences; full-time wage $6.00; expense shock spec 7.2.1; 17.1 item 5 verified in the UI).

---

## 1. Pillars

Taken verbatim from CONCEPT.md. Every system must serve at least one.

| # | Pillar | What it means in numbers |
|---|---|---|
| P1 | Consequences never reset | Every player choice appends a tagged entry to `history[]`. Events declared with `minYearsAfterTag` or `requiresTags` fire only when those tags are present. No tag is ever deleted. |
| P2 | The world reacts to your size | Net worth gates wealth tiers. Tiers unlock new action types and attract new threat events. Crossing a tier boundary is an observable state transition, not a visual flourish. |
| P3 | Delegation is progression | Weekly hours are fixed at 100. As responsibilities grow, the player must delegate or lose stat floors. Stage 1 ends before delegation begins, but the hour budget is the binding resource from week 1. |

---

## 2. Stage 1 Scope

**Label:** Hustle
**In-game span:** Age 21 to 30 (year 2026 to 2035)
**Turn rate:** 1 turn = 1 in-game week = 52 turns per year = 468 turns maximum
**City:** Kingston only for the vertical slice
**Scale:** Life-sim. One person. No employees, no corporate entities, no second city.
**Core resources:** Cash (USD), Energy, Reputation
**Key narrative beats:** grandmother's death and shoebox (year 2), first loan (available from year 1 at tier 0), first business (tier 1), first partner (optional, tier 1), Zurich mystery opens (year 2)

Stage 1 runs from week 0 to week 468 (age 21 to 30). In the vertical slice the run always ends at week 468 with the age-30 summary screen (section 15). Reaching Tier 2 (net worth $1,000,000 USD) before week 468 sets the `stage2_unlocked` flag and the run continues to week 468. Stage 2 is not built in the slice.

---

## 3. Loops

### 30-second loop (one week)
1. Player sees current state: cash, energy, reputation, week number, age, any pending events.
2. Player allocates 100 hours across action slots (work, hustle, rest, study, relationship, side-project).
3. Player resolves 0 to 2 events (drawn from the event queue; each event requires a choice).
4. `step()` runs: income and costs are computed, stats update, history entry is written, week advances.
5. Player sees net delta for the week.

### 10-minute loop (a milestone)
Reach the next wealth tier. Each tier is a visible label that changes the event pool and the available action set. Tier 0 to Tier 1 is the first meaningful milestone: clearing $10,000 net worth.

| Milestone | Approx. turns | What opens |
|---|---|---|
| First paycheck | Week 1 | Proves income works |
| First $1,000 saved | ~Week 8 | Side-hustle incentive confirmed |
| First $10,000 (Tier 1) | ~Week 30 to 60 | First business option; first loan eligible |
| Grandmother dies and shoebox arrives | Week 96 max, age 23 max | Mystery system activates |
| First business launched | Tier 1 | Business income replaces or supplements job income |
| First $100,000 | ~Week 100 to 150 | Early business or property play |
| First property | Tier 1 | Asset column appears in net worth |
| First $1,000,000 (Tier 2) | Week 312 to 468 (age 27 to 30) for the competent strategy | Sets `stage2_unlocked`; run continues to week 468 |
| Age 30 (week 468) | Week 468 | Run ends; summary screen |

### Multi-session loop
Stage 1 is 468 turns of compounding decisions. The player never replays turns. The interest rate on the first loan, the tags earned in year 1, and the partner chosen (or not) are all permanent. Seeing the consequences emerge is the multi-session motivation.

---

## 4. Time System

| Constant | Value | Config key |
|---|---|---|
| Weeks per year | 52 | `time.weeksPerYear` |
| Hours per week | 100 | `time.hoursPerWeek` |
| Start year | 2026 | `start.year` |
| Start age | 21 | `start.age` |
| Stage 1 max weeks | 468 | derived: 9 × 52 |

In-game date = start year + floor(week / 52). Age = start age + floor(week / 52).

The world clock fires authored lore events on specific in-game years regardless of the player's actions. Stage 1 world-clock events include:

- Week 1 (year 2026): Era 1 background — high rates, AI job automation, gig economy (affects job wages and availability)
- Week 96 max (year 2027–2028): Grandmother dies; shoebox event fires
- Week 365 (year 2033): Era 2 background — energy transition begins (affects hustle rates in construction/energy sectors)

---

## 5. Player Start State

| Field | Value | Source |
|---|---|---|
| `cashUsd` | 2000 | `start.cashUsd` in config |
| `energy` | 70 | `start.energy` in config |
| `reputation` | 10 | `start.reputation` in config |
| `age` | 21 | `start.age` in config |
| `cityId` | `kingston` | player selection (vertical slice: kingston only) |
| `week` | 0 | always |
| `seed` | supplied by caller | UI passes Date.now(); balance suite passes a fixed seed |
| `history` | `[]` | empty |
| `flags` | `{}` | empty |

---

## 6. Stats System

### 6.1 Cash

Cash is the primary resource. It is a floating-point USD value. Negative cash is not prevented by the engine — the game can go into debt — but reaching -$500 with no income scheduled triggers the "eviction warning" event. Reaching -$2,000 triggers forced eviction and a one-time loan offer from Halima Yusuf (see section 10).

Cash is stored as `cashUsd` in `GameState`.

### 6.2 Energy

| Property | Value | Config key |
|---|---|---|
| Minimum | 0 | — |
| Maximum | 100 | `energy.max` |
| Start | 70 | `start.energy` |
| Recovery rate (rest) | +0.6 per rest hour | `energy.restRecoveryPerHour` |
| Drain rate (work) | -0.5 per work hour | `energy.workCostPerHour` |
| Drain rate (hustle) | -0.8 per hustle hour | `energy.hustleCostPerHour` |
| Drain rate (study) | -0.3 per study hour | `energy.studyCostPerHour` |
| Drain rate (side-project) | -0.7 per side-project hour | `energy.sideProjectCostPerHour` |

Energy below 20 applies a productivity modifier: all income-generating hours produce 50% of normal output. This is called the burnout penalty.

Energy at 0 for 2 consecutive weeks sets the flag `burnout_active`. While `burnout_active` the player cannot allocate more than 40 hours to work or hustle combined, and energy recovery rate is halved. The flag clears when energy exceeds 50.

### 6.3 Reputation

| Property | Value |
|---|---|
| Minimum | 0 |
| Maximum | 100 |
| Start | 10 |

Reputation is a global score in Stage 1 (city-level scope becomes multi-city in Stage 2). Reputation gates some events (minimum reputation to receive certain loan offers, job offers, or partner introductions) and modifies hustle income: each point of reputation above 50 adds 1% to hustle hourly rate; each point below 50 subtracts 0.5%.

Reputation changes come exclusively from event choices and from the relationship action slot. It does not change passively each week.

### 6.4 Relationship scores

Recurring characters each have a trust score from -100 to 100, stored in `GameState.trust` (a `Record<string, number>`). Stage 1 characters with trust scores: `halima_yusuf`, `first_partner`, `sibling`. Trust scores gate events and color event text. Trust does not change passively.

### 6.5 Skills

Skills are integer values stored in `GameState.skills` (a `Record<string, number>`). Skills have no maximum in Stage 1. Each study hour in a skill adds 1 skill point (the increment rate will be tuned in `config.ts`). The skills relevant to Stage 1 are:

| Skill | What it modifies |
|---|---|
| `hustle` | Hustle hourly rate ceiling rises by $0.50 per point, up to a cap of $25/hr at skill 32 |
| `negotiation` | Loan interest rate reduced by 0.25 percentage points per point, floor 4% APR |
| `financial` | Unlocks the ability to read financial statements; gates first business action at skill 3 |
| `trade` | Unlocks buying and selling inventory as a side hustle |

---

## 7. Money System

### 7.1 Income sources

| Source | How it works | Config keys |
|---|---|---|
| Wage job | Player allocates work hours. Each work hour earns `baseHourlyWageUsd`. | `cities.kingston.baseHourlyWageUsd` = $3.50 |
| Side hustle | Player allocates hustle hours. Each hustle hour earns a random amount between `hustleHourlyMinUsd` and `hustleHourlyMaxUsd`, modified by reputation and hustle skill. | `hustleHourlyMinUsd` = $0, `hustleHourlyMaxUsd` = $9 |
| Business income | Unlocked at Tier 1. Passive weekly income from an owned business. Base amount × growth stage multiplier (section 8.4). | `businesses.types`, `businesses.stages` |
| Rental income | Unlocked at Tier 1 when the player buys a rental property. Weekly rent while occupied (section 9.1). | `property.types` |
| Loan proceeds | A one-time cash injection. Added to cash immediately; creates a liability. | See section 7.4 |

### 7.2 Expenses

| Expense | Frequency | Amount | Config key |
|---|---|---|---|
| Rent | Weekly, automatic | Varies by housing tier | `cities.kingston.housingTiers[n].weeklyRentUsd` |
| Living costs | Weekly, automatic | Fixed per city | `cities.kingston.weeklyLivingCostUsd` = $60 |
| Loan repayment | Weekly, automatic, once a loan is active | Principal + interest spread over loan term | Computed from loan state |
| Event costs | On event choice | Varies; declared in event JSON | Defined in `/content` |

Weekly burn = rent + living costs + loan repayment + expense shock.
Weekly net = income - weekly burn.

### 7.2.1 Expense shock (SM-034)

Serves P1 and the balance suite. Wage-only runs had zero variance across 300 seeds.

| Rule | Value | Config key |
|---|---|---|
| Chance per week | 2% (one `nextRandom` draw every week) | `expenses.shockChancePerWeek` = 0.02 |
| Amount when hit | Uniform $100 to $600 (second draw), rounded to cents | `expenses.shockMinUsd` = 100, `expenses.shockMaxUsd` = 600 |
| History | `unplanned_expense_<amount>`, tag `unplanned_expense` | — |

Expected cost over 468 weeks: 9.36 shocks × $350 = $3,276. Expected passive W468 median about $40,900, inside the $50,000 cap.

### 7.3 Net worth

In Stage 1, net worth = `cashUsd` + asset values - liabilities.
Assets: property book value, business book value.
Liabilities: outstanding loan principal.

The `netWorthUsd()` function in `sim/index.ts` must be extended to sum assets and subtract liabilities once those systems exist.

### 7.4 Loans

| Property | Value | Config key |
|---|---|---|
| Available from | Week 1 (Tier 0) | — |
| Minimum reputation to qualify | 15 | `loans.minReputation` |
| Loan amount tiers | $500, $1,000, $2,500, $5,000 | `loans.amountTiers` |
| Interest rate (no negotiation skill) | 18% APR | `loans.baseAprPct` |
| Interest rate floor (max negotiation) | 4% APR | `loans.minAprPct` |
| Rate reduction per negotiation skill point | 0.25 percentage points | `loans.aprReductionPerSkillPoint` |
| Repayment term | 26 weeks (6 months) or 52 weeks (1 year) | `loans.termWeeksOptions` |
| Max simultaneous loans | 1 in Tier 0, 2 in Tier 1 | `loans.maxSimultaneous` |
| Halima Yusuf first-loan override | Available to player who hits -$2,000 regardless of reputation | Hardcoded in event, not loan system |

APR converts to weekly rate = APR / 52. Weekly payment = (principal × weekly rate) / (1 - (1 + weekly rate)^(-term)). Rounded to nearest cent.

---

## 8. Job and Hustle System

### 8.1 Jobs (wage work)

A job is a contract the player holds. It sets `baseHourlyWageUsd` and a minimum weekly commitment (hours the player must allocate or risk losing the job). Jobs can be held simultaneously with side hustles.

| Job tier | Weekly min hours | Hourly wage (Kingston) | Notes |
|---|---|---|---|
| Gig (no contract) | 0 | $3.50 | Always available; no loss risk |
| Part-time | 20 | $5.00 | Lost if player allocates < 15 hours for 2 consecutive weeks |
| Full-time | 40 | $6.00 (TUNE-1) | Lost if player allocates < 30 hours for 2 consecutive weeks; bars > 20 hustle hours/week |
| Skilled (requires financial skill 3) | 40 | $12.00 | Unlocked by skill gate; lost on same terms as full-time |

All wage values are stored in config under `cities.kingston.jobs`. Kingston wages reflect the 2026 Jamaican informal/gig economy, denominated in USD at a fixed exchange rate of 155 JMD/USD for the vertical slice (this simplification will be revisited in Stage 2).

Job loss from insufficient hours appends tag `lost_job_<type>` to history and reduces reputation by 5.

### 8.2 Side hustles

Side hustles use the `hustle` action slot. The player earns a random amount per hour within [min, max], where the ceiling scales with hustle skill:

Effective max = min(`hustleHourlyMaxUsd` + 0.50 × hustle_skill, 25)

The random draw comes from `nextRandom(rngState)`. The draw is uniform within [min, effective max].

Hustle types are not explicitly differentiated in Stage 1 mechanics — the player narrates their own hustle. The event system surfaces specific hustle storylines (e.g., reselling electronics, running errands, dropshipping).

### 8.3 Business (Tier 1)

The player can launch a first business once they reach Tier 1 ($10,000 net worth) and have `financial` skill ≥ 3. Launching a business costs between $2,000 and $10,000 upfront (business-type dependent, declared in config). The business generates passive weekly income and can grow or shrink based on events.

| Business type | Launch cost | Base weekly income | Sector |
|---|---|---|---|
| Food stall | $2,000 | $180/week | Food |
| Delivery service | $3,500 | $260/week | Logistics |
| Short-term rental room | $1,500 (deposit + setup) | $220/week | Rental |
| Content brand | $500 | $80/week, grows with reputation | Content |

Business values are stored in config under `businesses.types`. Business income is added to `cashUsd` each week automatically once the business is active. Business events can increase or decrease weekly income, trigger costs, or offer growth opportunities.

### 8.4 Business growth (SM-017)

Serves P2 (the world reacts to your size) and the 10-minute loop. Every business asset carries `stage` (1 to 4), `weeksAtStage` and `reinvestedAtStageUsd`.

| Stage | Name | Income multiplier on base weekly income | Min weeks at previous stage to enter | Reinvestment at previous stage to enter | Weekly failure chance |
|---|---|---|---|---|---|
| 1 | Startup | 1.0 | entered at launch | entered at launch | 0.30% |
| 2 | Established | 2.0 | 26 | $5,000 | 0.15% |
| 3 | Growing | 4.0 | 52 | $20,000 | 0.10% |
| 4 | Scaled | 8.0 | 78 | $60,000 | 0.05% |

Rules:

1. `reinvestBusiness(state, assetId, amountUsd)` deducts `amountUsd` from cash and adds it to `reinvestedAtStageUsd` and to the asset's `bookValueUsd`. Errors: unknown asset id, asset is not a business, `amountUsd <= 0`, `cashUsd < amountUsd`, business already at stage 4.
2. In `step()`, a business advances one stage when both `weeksAtStage >= minWeeks` and `reinvestedAtStageUsd >= reinvestment` for the next stage. On advance: `stage += 1`, `weeksAtStage = 0`, `reinvestedAtStageUsd = 0`, `weeklyIncomeUsd = base × multiplier`, history tag `grew_<businessTypeId>_stage<N>`.
3. Book value = launch cost + all reinvestment. Growth never raises book value by itself.
4. Failure: each week, one `nextRandom` draw per business. If the draw is below the stage failure chance the business fails. The chance doubles while energy < 20 (`energy.burnoutThreshold`). On failure: the asset is removed, history tag `lost_business_<businessTypeId>`, reputation -5 (clamped at 0).
5. Max one stage advance per business per week.

Scaled income per business type: food stall $1,440/week, delivery service $2,080/week, short-term rental room $1,760/week, content brand $640/week. Fastest path from launch to stage 4: 156 weeks and $85,000 reinvestment.

---

## 9. Housing System

Housing is an automatic weekly expense. The player starts in the base tier. Moving up requires a deposit and sufficient cash flow.

| Tier | Name | Weekly rent (Kingston) | Deposit | Conditions to access | Config key |
|---|---|---|---|---|---|
| 0 | Shared room | $90/week | $0 | Start state | `housingTiers[0]` |
| 1 | Private room | $140/week | $280 (2 weeks) | cashUsd ≥ $500 | `housingTiers[1]` |
| 2 | Studio apartment | $220/week | $660 (3 weeks) | cashUsd ≥ $1,500 | `housingTiers[2]` |
| 3 | 1-bedroom flat | $320/week | $960 (3 weeks) | cashUsd ≥ $5,000 | `housingTiers[3]` |
| 4 | Owned property | $0/week (mortgage replaces rent) | Requires Tier 1 net worth and $10,000 down | Tier 1 + net worth ≥ $20,000 | `housingTiers[4]` |

**Eviction:** If `cashUsd` falls below 0 at the end of a week, an "overdue rent" counter increments. If overdue rent reaches 2, the eviction event fires. Eviction forces the player to tier 0 housing, pays back any owed rent from future income at $20/week forced deduction, and appends tag `evicted` to history. The `evicted` tag increases insurance premiums in Stage 2 and reduces trust with Halima Yusuf by 20.

Rent values are in config under `cities.kingston.housingTiers`.

Housing tier 4 (owner-occupied) keeps its existing behavior. Rental properties in section 9.1 are investments and do not change `housingTier`.

### 9.1 Rental property (SM-016)

Serves P2 and the CONCEPT milestone "first asset". Requires `wealthTier >= 1`. Max 3 owned properties in Stage 1 (`property.maxOwned`).

| Property type id | Name | Price | Weekly rent when occupied | Gross yield per year |
|---|---|---|---|---|
| `kgn_studio` | Studio, Half Way Tree | $30,000 | $60 | 10.4% |
| `kgn_two_bed` | 2-bed apartment, New Kingston | $65,000 | $120 | 9.6% |
| `kgn_house` | 3-unit house, Barbican | $150,000 | $260 | 9.0% |

| Rule | Value | Config key |
|---|---|---|
| Minimum down payment | 20% of price | `property.minDownPaymentPct` = 0.20 |
| Closing cost at purchase | 3% of price, paid in cash, not added to book value | `property.closingCostPct` = 0.03 |
| Mortgage APR | 9% | `property.mortgageAprPct` = 9 |
| Mortgage terms | 520 or 1040 weeks | `property.mortgageTermWeeksOptions` = [520, 1040] |
| Mortgage payment | Same amortization formula as section 7.4 | — |
| Principal reduction | Each week principal -= (payment - principal × APR / 100 / 52), rounded to cents | — |
| Maintenance | 1% of current book value per year, charged weekly as bookValue × 0.01 / 52 | `property.maintenancePctPerYear` = 0.01 |
| Vacancy start | 1.5% chance per occupied property per week, one `nextRandom` draw per property | `property.vacancyChancePerWeek` = 0.015 |
| Vacancy length | 6 weeks; no rent while vacant; maintenance and mortgage still charged | `property.vacancyWeeks` = 6 |
| Appreciation | Book value × 1.04 on every 52-week anniversary of purchase, rounded to cents | `property.appreciationPctPerYear` = 0.04 |
| Sale | Proceeds = bookValue × (1 - 0.05) - remaining mortgage principal; proceeds can be negative | `property.sellingCostPct` = 0.05 |

Actions: `buyProperty(state, propertyTypeId, downPaymentUsd, termWeeks)` and `sellProperty(state, assetId)`. A down payment equal to the price creates no mortgage. Purchase adds an `Asset` with `kind: "property"` and a `Liability` with `kind: "mortgage"` linked by `propertyId`. Tags: `bought_<propertyTypeId>`, `sold_property`.

---

## 10. Event System

### 10.1 Architecture

Events are declared in `/content/events/*.json` and validated against `/content/schema/event.schema.json`. The simulation never hardcodes event text. Each week, the event engine:

1. Filters all events to those whose `trigger` conditions are met by the current state.
2. Removes events marked `once: true` whose IDs appear in `state.firedEvents`.
3. Performs weighted random selection (using `nextRandom(rngState)`) to pick 0, 1, or 2 events for this week.
4. The player resolves each event by choosing an option. Effects are applied immediately.
5. The event ID is added to `state.firedEvents`. History entry is written.

### 10.2 Trigger fields

| Field | Type | Meaning |
|---|---|---|
| `minWeek` | int | Event not eligible before this week |
| `maxAge` | int | Event not eligible after player reaches this age |
| `minCashUsd` | number | Minimum cash to be eligible |
| `maxCashUsd` | number | Maximum cash to be eligible |
| `cities` | string[] | Eligible only in these cities |
| `requiresTags` | string[] | All tags must be in `state.history` |
| `forbidsTags` | string[] | None of these tags may be in `state.history` |
| `minYearsAfterTag` | number | Tag must have been added at least this many in-game years ago |
| `weight` | number | Relative probability weight (default 10) |
| `once` | bool | If true, fires at most once per run |

### 10.3 Event categories for Stage 1

The vertical slice targets 40 events across these categories:

| Category | Count target | Description |
|---|---|---|
| Family | 6 | Grandmother, sibling, absent parent |
| Financial opportunity | 8 | Loan offers, business leads, investment tips |
| Financial threat | 7 | Scam, theft, bad debt, unexpected bill |
| Relationship | 6 | First partner, Halima Yusuf, neighborhood contacts |
| World clock | 4 | Era 1 lore beats; Kingston news |
| Consequence | 5 | Delayed events triggered by earlier tags |
| Hustle/work | 4 | Job offers, hustle tips, workplace events |
| Shortcut (SM-018) | 8 to 10 | Shady or shortcut choices: cash deals, cutting out a partner, skipping permits, loan-shark money |
| Shortcut consequence (SM-018) | 3 minimum | Delayed follow-ups firing 1 to 4 years after a shortcut tag |

Total: 40 authored in SM-009, 51 to 53 after SM-018. CONCEPT.md lists 40 events; the slice treats 40 as a floor (see section 18).

### 10.4 Effect fields

Effects are applied atomically when the player selects a choice:

| Field | Type | Action |
|---|---|---|
| `cashUsd` | number | Added to `state.cashUsd` |
| `energy` | number | Added to `state.energy` (clamped 0–100) |
| `reputation` | number | Added to `state.reputation` (clamped 0–100) |
| `trust` | Record<string, number> | Each key added to `state.trust[key]` |
| `addTags` | string[] | Appended to `state.history` current entry's tags |
| `setFlags` | string[] | Each key set to `true` in `state.flags` |

### 10.5 Consequence events (Pillar 1)

A consequence event has `minYearsAfterTag` and `requiresTags` both set. It fires only once the declared tags are present AND the specified in-game time has elapsed since the tag was first added. This is the mechanical expression of "every shortcut you took comes back years later."

Example: an event with `requiresTags: ["took_shady_loan"]` and `minYearsAfterTag: 2` fires 2 or more in-game years after the player took a shady deal. The player cannot prevent or delete the tag.

---

## 11. Consequence Model

Every time a player makes a meaningful choice, the engine writes a `HistoryEntry`:

```
{ week: number, action: string, tags: string[] }
```

Tags are lowercase snake_case strings. They are never deleted. The full set of tags attached to a player's run constitutes their permanent record.

### Tag naming conventions

| Prefix | Meaning |
|---|---|
| `took_` | Player accepted something (loan, deal, offer) |
| `cut_` | Player cut out or betrayed someone |
| `paid_` | Player honored a financial obligation |
| `evicted` | Player was evicted |
| `left_` | Player walked away from something |
| `has_` | Player currently possesses something |
| `knows_` | Player has information |
| `lost_` | Player lost something (job, asset) |
| `launched_` | Player started something |

Stage 1 canonical consequence chain:

1. Player takes a shady loan → tag `took_shady_loan` → at year +2, event: debt collector contacts them
2. Player cuts out first partner → tag `cut_partner_<name>` → at year +3 (Stage 2), partner becomes a competitor
3. Player is evicted → tag `evicted` → Halima Yusuf trust -20; insurance cost +10% in Stage 2
4. Player ignores sibling money request → tag `ignored_sibling_ask` → at year +1, sibling trust drops 30 and a loyalty event is blocked

### Shady tags

`content/tags.json` holds the canonical `shadyTags` array (SM-018). Starting list: `took_shady_loan`, `took_loan_shark`, `cash_deal_shady`, `cut_out_partner`, `cut_partner_first`, `skipped_permit`, `undeclared_income`. A choice is shady when its `addTags` contains any shady tag. The balance suite reads this file to classify choices.

### Delayed consequence event

A delayed consequence event is any event whose trigger sets `minYearsAfterTag`. Its delay is the number of weeks between the week the required tag was first added and the week the event fires. CONCEPT.md requires delays of 1 to 5 years (52 to 260 weeks).

---

## 12. Tier / Progression

### Wealth tier gates

| Tier | Net worth threshold | Unlocks |
|---|---|---|
| 0 (Scrub) | < $10,000 | Jobs, side hustles, one loan at a time |
| 1 (Hustler) | $10,000 to $999,999 | First business, first property, two simultaneous loans, first hire event |
| 2 (Owner) | ≥ $1,000,000 | Stage 2 begins; Operator scale |

Tier is recalculated every turn. Downward tier movement is possible — if net worth falls below the tier floor due to losses, the tier reverts and the unlocked actions become unavailable until net worth recovers.

### Balance targets (from CONCEPT.md, restored 2026-11-09)

CONCEPT.md: "the median competent strategy reaches $1M between age 27 and 32. A greedy strategy reaches it faster but triggers at least 1 major delayed consequence. A passive strategy stays under $50K."

| Strategy | Target | Pass rule in `tests/balance/report.md` |
|---|---|---|
| Passive (40 work, 60 rest, no hustle, no loans, no business, lowest-risk event choices) | Stays under $50K | Median net worth at week 468 < $50,000 |
| Competent (balanced work/hustle/study, avoids shady choices) | Median reaches $1M between age 27 and 32 (week 312 to 572) | Slice runs end at week 468, so pass if median net worth at week 468 ≥ $1,000,000, OR median age at first reaching $1M is between 27.0 and 30.0 |
| Greedy (max immediate cash, takes shady choices) | Reaches $1M faster and triggers at least 1 major delayed consequence | Median age at first $1M < competent median age at first $1M, AND ≥ 50% of greedy runs fire ≥ 1 major delayed consequence event |

A major delayed consequence event is a delayed consequence event (section 11) in which every choice has `cashUsd <= -250` or `reputation <= -10`. The report lists the "any delayed consequence" rate for reference only. It does not count toward T3.

Age at first $1M = 21 + (first week with `netWorthUsd >= 1,000,000`) / 52, reported to 1 decimal. A run that never reaches $1M by week 468 counts as "not reached" and sorts above every reached value. If more than 50% of runs are "not reached", the median is "not reached".

### Checkpoint guide rails (not pass/fail)

| Strategy | Week 156 (age 24) | Week 312 (age 27) | Week 468 (age 30) |
|---|---|---|---|
| Passive | ≤ $20,000 | ≤ $35,000 | < $50,000 |
| Competent | ≥ $60,000 | ≥ $300,000 | ≥ $1,000,000 |
| Greedy | ≥ competent median | ≥ competent median | ≥ competent median |

The balance suite (`npm run balance`) runs 300 headless seeds (0 to 299) per strategy.

### End of run

Reaching $1M sets `stage2_unlocked`. The run ends when `state.week` reaches 468: `stage1Complete` is set, a summary is built (section 15), and `step()` throws `"Stage 1 is complete"` on any further call.

---

## 13. RNG Seeding Contract

The seeded PRNG is `mulberry32` implemented in `sim/rng.ts`. Its state lives in `GameState.rngState`. All randomness in the simulation passes through `nextRandom(rngState)` or `nextInt(rngState, min, max)` — never through `Math.random()`, `Date.now()`, or any external source.

The UI may seed `rngState` with `Date.now() >>> 0` on new game creation. The balance suite uses a fixed seed sequence (0, 1, 2, ... 299) for reproducibility.

Determinism contract: `newGame(seed)` followed by the identical sequence of `step(state, input)` calls on any machine, in any browser, at any time must produce bit-identical `GameState` values.

---

## 14. Config Knobs

All tunable numbers live in `sim/config.ts`. The table below extends the current skeleton with everything Stage 1 needs. The sim-engineer populates actual values ticket by ticket; this table defines the keys.

| Config key | Type | Purpose |
|---|---|---|
| `start.year` | number | Game start year |
| `start.age` | number | Player start age |
| `start.cashUsd` | number | Starting cash |
| `start.energy` | number | Starting energy |
| `start.reputation` | number | Starting reputation |
| `time.weeksPerYear` | number | Calendar conversion |
| `time.hoursPerWeek` | number | Weekly hour budget |
| `energy.max` | number | Energy ceiling |
| `energy.restRecoveryPerHour` | number | Rest efficiency |
| `energy.workCostPerHour` | number | Work energy drain |
| `energy.hustleCostPerHour` | number | Hustle energy drain |
| `energy.studyCostPerHour` | number | Study energy drain |
| `energy.sideProjectCostPerHour` | number | Side-project drain |
| `energy.burnoutThreshold` | number | Energy floor before penalty applies |
| `energy.burnoutProductivityMult` | number | Income multiplier during burnout (0.5) |
| `energy.burnoutActiveThreshold` | number | Energy level that sets burnout_active flag (0) |
| `energy.burnoutClearThreshold` | number | Energy level that clears burnout_active flag (50) |
| `energy.burnoutMaxHours` | number | Max work+hustle hours while burnout_active (40) |
| `energy.burnoutRecoveryMult` | number | Recovery rate multiplier while burnout_active (0.5) |
| `cities.kingston.weeklyRentUsd` | number | Base rent (tier 0) |
| `cities.kingston.weeklyLivingCostUsd` | number | Fixed weekly living costs |
| `cities.kingston.baseHourlyWageUsd` | number | Gig wage rate |
| `cities.kingston.hustleHourlyMinUsd` | number | Hustle floor |
| `cities.kingston.hustleHourlyMaxUsd` | number | Hustle ceiling (pre-skill) |
| `cities.kingston.hustleSkillCeilingPerPoint` | number | Ceiling increase per hustle skill point (0.50) |
| `cities.kingston.hustleAbsoluteCeiling` | number | Absolute hustle ceiling regardless of skill (25) |
| `cities.kingston.housingTiers` | array | Each tier's weeklyRentUsd, deposit, cashRequired |
| `cities.kingston.jobs` | array | Each job type's minHours, hourlyWage, lossThreshold |
| `loans.baseAprPct` | number | Base loan APR (18) |
| `loans.minAprPct` | number | Floor APR with max negotiation (4) |
| `loans.aprReductionPerSkillPoint` | number | APR reduction per negotiation skill point (0.25) |
| `loans.amountTiers` | number[] | Available loan amounts |
| `loans.termWeeksOptions` | number[] | Available repayment terms in weeks |
| `loans.maxSimultaneous` | Record<tier, number> | Max simultaneous loans by wealth tier |
| `loans.minReputation` | number | Minimum reputation to qualify (15) |
| `loans.emergencyMinCash` | number | Cash floor that triggers Halima emergency offer (-2000) |
| `businesses.types` | array | Each business type's launchCost, weeklyIncome, sector |
| `skills.hustleWageCeilingPerPoint` | number | Hustle ceiling increase per skill point (0.50) |
| `skills.negotiationAprReductionPerPoint` | number | APR reduction per negotiation skill point (0.25) |
| `skills.financialBusinessUnlockLevel` | number | Financial skill level to unlock business action (3) |
| `reputation.hustleBonus` | number | % hustle income bonus per rep point above 50 (1%) |
| `reputation.hustlePenalty` | number | % hustle income penalty per rep point below 50 (0.5%) |
| `reputation.jobLossPenalty` | number | Reputation loss on job loss (-5) |
| `progression.tier1Threshold` | number | Net worth to reach Tier 1 (10000) |
| `progression.tier2Threshold` | number | Net worth to reach Tier 2 / Stage 2 (1000000) |
| `progression.overdueCashFloor` | number | Cash level that increments overdue counter (0) |
| `progression.evictionOverdueCount` | number | Overdue weeks before eviction (2) |
| `progression.evictionForcedRepayPerWeek` | number | Weekly forced deduction after eviction (20) |
| `events.maxPerWeek` | number | Maximum events drawn per turn (2) |
| `events.defaultWeight` | number | Default event weight if not specified (10) |
| `businesses.stages` | array | Per stage: incomeMult (1, 2, 4, 8), minWeeksToEnter (0, 26, 52, 78), reinvestToEnterUsd (0, 5000, 20000, 60000), weeklyFailureChance (0.003, 0.0015, 0.001, 0.0005) |
| `businesses.burnoutFailureMult` | number | Failure chance multiplier while energy < 20 (2) |
| `businesses.failureReputationPenalty` | number | Reputation lost on business failure (5) |
| `property.types` | array | Per type: id, priceUsd, weeklyRentUsd (section 9.1) |
| `property.maxOwned` | number | Max rental properties owned (3) |
| `property.minDownPaymentPct` | number | 0.20 |
| `property.closingCostPct` | number | 0.03 |
| `property.mortgageAprPct` | number | 9 |
| `property.mortgageTermWeeksOptions` | number[] | [520, 1040] |
| `property.maintenancePctPerYear` | number | 0.01 |
| `property.vacancyChancePerWeek` | number | 0.015 |
| `property.vacancyWeeks` | number | 6 |
| `property.appreciationPctPerYear` | number | 0.04 |
| `property.sellingCostPct` | number | 0.05 |
| `cities.kingston.jobs[].maxHustleHours` | number or null | Hustle cap while the job is held: full_time 20, skilled 20, others null (SM-030) |
| `cities.kingston.jobs[].requiresSkills` | Record<string, number> | Skill gate to take the job: skilled `{ financial: 3 }`, others `{}` (SM-031) |
| `expenses.shockChancePerWeek` | number | 0.02 (section 7.2.1) |
| `expenses.shockMinUsd` | number | 100 |
| `expenses.shockMaxUsd` | number | 600 |
| `progression.stage1EndWeek` | number | Week the run ends (468) |
| `progression.summaryTopChoices` | number | Choices listed on the summary (5) |

---

## 15. Fail States

| State | Condition | What happens |
|---|---|---|
| Eviction | Cash < 0 for 2 consecutive weeks | Player forced to tier 0 housing; tag `evicted` added; debt repayment enforced |
| Burnout lock | Energy = 0 for 2 consecutive weeks | `burnout_active` flag set; hour cap applies until energy > 50 |
| End of Stage 1 | `state.week` reaches 468, regardless of net worth | `stage1Complete = true`; summary built; summary screen with New run button (SM-020, SM-021) |
| Debt spiral | Loan missed payment (not yet implemented in Stage 1; placeholder for Stage 2) | — |

There is no "game over" screen in Stage 1. The player can always continue from any fail state until week 468, but consequences accumulate.

### 15.1 Age-30 summary (SM-020)

`state.summary` fields:

| Field | Definition |
|---|---|
| `finalNetWorthUsd` | `netWorthUsd(state)` at week 468 |
| `wealthTierReached` | Highest `wealthTier` held at any week of the run |
| `topChoices` | Up to 5 event choices with the largest absolute net worth effect, sorted descending by absolute effect, ties by earlier week. Each item: `week`, `eventId`, `choiceIndex`, `netWorthDeltaUsd` |
| `consequencesFired` | Ids of fired delayed consequence events (section 11), in firing order |

Net worth effect of a choice = `netWorthUsd` after `applyEvent` minus `netWorthUsd` before. `applyEvent` appends each choice to `state.choiceLog`.

---

## 16. UI Screens (Stage 1 Phone UI)

The phone is the lore delivery channel for Stage 1 (per LORE.md). The UI is mobile-first.

| Screen | Purpose |
|---|---|
| Home / Week summary | Current stats bar (cash, energy, reputation), last week's delta, age and date |
| Hour allocator | Drag or tap to split 100 hours across action slots for the upcoming week |
| Event card | Full-screen card per event: channel icon, title, body, 2–4 choice buttons |
| Net worth tracker | Running line chart of cashUsd by week; tier markers on the x-axis |
| History log | Scrollable list of `HistoryEntry` items; filterable by tag |
| Loan screen | Available loans, active loans, payment schedule |
| Business screen | Unlocked at Tier 1; shows active businesses and weekly income |
| Property screen | Unlocked at Tier 1; owned properties, occupancy, mortgage balance |
| Age-30 summary | Shown at week 468; final net worth, tier reached, top 5 choices, consequences fired, New run button |
| Settings | Seed display (for sharing runs), save/load from localStorage |

UI screens are described for scope; the ui-engineer owns implementation. No screen blocks the vertical slice until the sim produces meaningful output.

---

## 17. Vertical Slice Scope and Exit Criteria

The vertical slice is Stage 1, Kingston only, 40 or more events. It is complete when every item in both lists is true.

### 17.1 Player-facing exit criteria

1. New run in Kingston at 21 with $2,000.
2. The 100-hour weekly split changes outcomes.
3. Events fire with costly choices.
4. At least 3 delayed consequences fire 1 to 5 years after their trigger in real runs.
5. The player can take a loan, start a business and buy a property.
6. Close the browser and reload the save.
7. The run ends at age 30 (week 468) with a summary screen.

How each is verified:

| # | Verification |
|---|---|
| 1 | `newGame(seed, "kingston")` returns age 21, cash $2,000; the UI shows both on first load |
| 2 | Passive, competent and greedy medians at week 468 differ by ≥ $50,000 pairwise in the balance report |
| 3 | ≥ 10 events in content offer a choice with `cashUsd <= -200` or a shady tag |
| 4 | Balance report lists ≥ 3 distinct delayed consequence event ids that fired with a delay of 52 to 260 weeks across the 900 runs |
| 5 | `takeLoan`, `launchBusiness` and `buyProperty` each succeed in tests and in the phone UI (Bank, Business and Property apps). `npm run play` was cancelled with SM-022 |
| 6 | UI reload restores the identical serialized state from localStorage |
| 7 | `stage1Complete` is true after step 468; the UI shows the summary screen (SM-020, SM-021) |

### 17.2 Technical exit criteria

1. `npm test` is green.
2. `npm run balance` runs 300 seeds per strategy (passive, competent, greedy) and `tests/balance/report.md` meets all section 12 targets:
   - Passive median net worth at week 468 < $50,000.
   - Competent median net worth at week 468 ≥ $1,000,000, or competent median age at first $1M between 27.0 and 30.0.
   - Greedy median age at first $1M < competent median age at first $1M.
   - ≥ 50% of greedy runs fire ≥ 1 major delayed consequence event (section 12).
3. A human can play from week 1 to week 52 in the UI without a crash or uncaught error.
4. The shoebox event fires before week 97 in every run.
5. The first loan is obtainable in week 1 if reputation ≥ 15.
6. Eviction can be triggered and recovered from.
7. All events validate against the JSON schema.
8. `netWorthUsd()` correctly sums cash + assets - liabilities.

---

## 18. Open Questions and Conflicts

| Date | Conflict | Resolution | Status |
|---|---|---|---|
| 2026-11-09 | Section 17 balance targets (passive $10K to $80K, competent $500K to $2M, greedy $800K to $3M at week 468, greedy "consequence tag" 50%) contradicted CONCEPT.md (competent median $1M at age 27 to 32, greedy faster plus ≥ 1 delayed consequence, passive under $50K). Section 12 curve (competent ~$900K at week 468) also missed the CONCEPT target. | CONCEPT targets restored in sections 12 and 17. Greedy metric changed from "consequence tag present" to "delayed consequence event fired". Human directed the fix. | Resolved |
| 2026-11-09 | CONCEPT.md lists 40 events for the slice. SM-018 adds 11 to 13 events, for 51 to 53. | 40 treated as a floor. Human directed SM-018. | Resolved by human direction |
| 2026-11-09 | Current passive median at week 468 is $62,400 (report.md), above the restored $50K cap. | TUNE-1 cut the full-time wage from $7.00 to $6.00. Passive W468 median is $44,190. | Resolved |
| 2026-11-09 | Exit criterion 5 needs loan, business and property actions. No UI ticket exposes them; SM-022 exposes them in the CLI only. | Human cancelled SM-022 and chose the phone UI. SM-023 shipped loans, jobs, housing and business launch. SM-026 adds property and Grow. | Resolved by human direction |
| 2026-11-09 | T3 counted any delayed consequence. CONCEPT requires "at least 1 major delayed consequence". | T3 counts major delayed consequences only (section 12 definition). | Resolved |

Conflicts with CONCEPT.md or LORE.md are logged here and in STATE.md and escalated to the human.
