# Game Design Document: Self Made — Stage 1 (Hustle)

Owned by the pm agent. Source of truth for the Stage 1 vertical slice.
Last updated: 2026-11-09.

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

Stage 1 ends when Stage 2 starts. Stage 2 starts when the player reaches Tier 2: net worth $1,000,000 USD. Stage 1 also ends at age 30 regardless — a time-out loss if the player has not reached $1M by week 468.

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
| First $1,000,000 (Tier 2) | ~Week 300 to 468 | Stage 1 exit; Stage 2 begins |

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
| Business income | Unlocked at Tier 1. Passive weekly income from an owned business. Amount set when business is launched; grows by business performance events. | Defined per business type in config |
| Rental income | Unlocked at Tier 1 when the player buys property. Passive weekly income equal to `weeklyRentCollected`. | Defined per housing tier |
| Loan proceeds | A one-time cash injection. Added to cash immediately; creates a liability. | See section 7.4 |

### 7.2 Expenses

| Expense | Frequency | Amount | Config key |
|---|---|---|---|
| Rent | Weekly, automatic | Varies by housing tier | `cities.kingston.housingTiers[n].weeklyRentUsd` |
| Living costs | Weekly, automatic | Fixed per city | `cities.kingston.weeklyLivingCostUsd` = $60 |
| Loan repayment | Weekly, automatic, once a loan is active | Principal + interest spread over loan term | Computed from loan state |
| Event costs | On event choice | Varies; declared in event JSON | Defined in `/content` |

Weekly burn = rent + living costs + loan repayment.
Weekly net = income - weekly burn.

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
| Full-time | 40 | $7.00 | Lost if player allocates < 30 hours for 2 consecutive weeks; bars > 20 hustle hours/week |
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

Total: 40

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

---

## 12. Tier / Progression

### Wealth tier gates

| Tier | Net worth threshold | Unlocks |
|---|---|---|
| 0 (Scrub) | < $10,000 | Jobs, side hustles, one loan at a time |
| 1 (Hustler) | $10,000 to $999,999 | First business, first property, two simultaneous loans, first hire event |
| 2 (Owner) | ≥ $1,000,000 | Stage 2 begins; Operator scale |

Tier is recalculated every turn. Downward tier movement is possible — if net worth falls below the tier floor due to losses, the tier reverts and the unlocked actions become unavailable until net worth recovers.

### Expected progression curve

| Play style | Age 24 (week 156) | Age 27 (week 312) | Age 30 (week 468) |
|---|---|---|---|
| Passive (rest-heavy, no hustle) | ~$5,000 | ~$12,000 | ~$30,000 |
| Competent (balanced work/hustle/study) | ~$18,000 | ~$180,000 | ~$900,000 |
| Greedy (maximize income, skip rest, take loans, shady deals) | ~$30,000 | ~$450,000 | ~$1,500,000 |

Balance target from CONCEPT.md: median competent strategy reaches $1M between age 27 and 32.

The balance suite (`npm run balance`) must run 100 headless seeds with each of three scripted strategies and verify these medians hold within ±20%.

### Stage 1 → Stage 2 exit conditions

All must be true:

1. `netWorthUsd(state)` ≥ $1,000,000
2. `state.week` ≤ 468

If condition 2 fails before condition 1, the game presents a "time-out" outcome screen and offers a restart.

---

## 13. RNG Seeding Contract

The seeded PRNG is `mulberry32` implemented in `sim/rng.ts`. Its state lives in `GameState.rngState`. All randomness in the simulation passes through `nextRandom(rngState)` or `nextInt(rngState, min, max)` — never through `Math.random()`, `Date.now()`, or any external source.

The UI may seed `rngState` with `Date.now() >>> 0` on new game creation. The balance suite uses a fixed seed sequence (0, 1, 2, ... 99) for reproducibility.

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

---

## 15. Fail States

| State | Condition | What happens |
|---|---|---|
| Eviction | Cash < 0 for 2 consecutive weeks | Player forced to tier 0 housing; tag `evicted` added; debt repayment enforced |
| Burnout lock | Energy = 0 for 2 consecutive weeks | `burnout_active` flag set; hour cap applies until energy > 50 |
| Time-out | Week 468 without reaching $1M net worth | Outcome screen: summary of run; option to restart |
| Debt spiral | Loan missed payment (not yet implemented in Stage 1; placeholder for Stage 2) | — |

There is no "game over" screen in Stage 1. The player can always continue from any fail state, but consequences accumulate.

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
| Settings | Seed display (for sharing runs), save/load from localStorage |

UI screens are described for scope; the ui-engineer owns implementation. No screen blocks the vertical slice until the sim produces meaningful output.

---

## 17. Vertical Slice Scope and Exit Criteria

The vertical slice is Stage 1, Kingston only, 40 events. It is complete when ALL of the following are true:

1. `npm test` is green.
2. `npm run balance` runs 100 seeds with passive, competent, and greedy strategies and produces a `report.md` where:
   - Passive median net worth at week 468 is between $10,000 and $80,000.
   - Competent median net worth at week 468 is between $500,000 and $2,000,000.
   - Greedy median net worth at week 468 is between $800,000 and $3,000,000.
   - Greedy runs trigger at least 1 consequence tag 50% of the time.
3. A human can play from week 1 to week 52 in the UI without a crash or uncaught error.
4. The shoebox event fires before week 97 in every run.
5. The first loan is obtainable in week 1 if reputation ≥ 15.
6. Eviction can be triggered and recovered from.
7. All 40 events validate against the JSON schema.
8. `netWorthUsd()` correctly sums cash + assets - liabilities.

---

## 18. Open Questions and Conflicts

None at time of writing. Conflicts with CONCEPT.md or LORE.md will be logged in STATE.md and escalated to the human.
