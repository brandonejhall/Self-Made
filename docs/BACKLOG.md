# Backlog

The pm agent owns this file. Other agents add items only under "Requested".

## Ticket format

```
### SM-000: Title
- Owner: sim-engineer | ui-engineer | lore-writer | balance-qa
- Goal: one sentence
- Files: paths touched
- Depends on: SM-xxx
- Size: S | M (split anything larger)
- Acceptance:
  - [ ] Testable statement 1
  - [ ] Testable statement 2
```

---

## Ready

---

## SM-001: Extend GameState with skills, trust, assets, liabilities, and firedEvents

**Owner:** sim-engineer
**Depends on:** none
**Status:** Ready

### What
The current `GameState` type is missing the fields that every Stage 1 system depends on: `skills` (Record mapping skill name to integer), `trust` (Record mapping character id to number -100 to 100), `assets` (array of owned assets), `liabilities` (array of active loans), and `firedEvents` (string set of event IDs already fired). This ticket extends the types and the `newGame()` factory so the rest of the vertical slice can build on a complete state shape. No game logic changes — only type definitions and initialization.

### Acceptance criteria
- [ ] `GameState` has field `skills: Record<string, number>` initialized to `{}` by `newGame()`
- [ ] `GameState` has field `trust: Record<string, number>` initialized to `{}` by `newGame()`
- [ ] `GameState` has field `assets: Asset[]` initialized to `[]` by `newGame()`, where `Asset` has at minimum `{ id: string; type: string; bookValueUsd: number }`
- [ ] `GameState` has field `liabilities: Liability[]` initialized to `[]` by `newGame()`, where `Liability` has at minimum `{ id: string; principalUsd: number; weeklyPaymentUsd: number; weeksRemaining: number }`
- [ ] `GameState` has field `firedEvents: string[]` initialized to `[]` by `newGame()`
- [ ] `GameState` has field `housingTier: number` initialized to `0` by `newGame()`
- [ ] `GameState` has field `overdueWeeks: number` initialized to `0` by `newGame()`
- [ ] `GameState` has field `burnoutWeeks: number` initialized to `0` by `newGame()`
- [ ] `GameState` has field `wealthTier: number` initialized to `0` by `newGame()`
- [ ] All existing tests still pass (`npm test` green)
- [ ] `serialize` / `deserialize` round-trip produces identical state for a state that uses all new fields

---

## SM-002: Extend sim/config.ts with full Stage 1 economy numbers

**Owner:** sim-engineer
**Depends on:** SM-001
**Status:** Ready

### What
`sim/config.ts` currently has only the Kingston city block with placeholder values. This ticket populates every config key specified in GDD section 14: energy drain rates for study and side-project, burnout thresholds, Kingston housing tiers (5 tiers), Kingston job types (4 types), loan parameters, business types (4 types), skill rate constants, reputation modifiers, progression thresholds, and event draw limits. All numbers must match GDD section values exactly. No simulation logic changes — only the config object.

### Acceptance criteria
- [ ] `CONFIG.energy.studyCostPerHour` exists and equals `0.3`
- [ ] `CONFIG.energy.sideProjectCostPerHour` exists and equals `0.7`
- [ ] `CONFIG.energy.burnoutThreshold` exists and equals `20`
- [ ] `CONFIG.energy.burnoutProductivityMult` exists and equals `0.5`
- [ ] `CONFIG.energy.burnoutActiveThreshold` exists and equals `0`
- [ ] `CONFIG.energy.burnoutClearThreshold` exists and equals `50`
- [ ] `CONFIG.energy.burnoutMaxHours` exists and equals `40`
- [ ] `CONFIG.energy.burnoutRecoveryMult` exists and equals `0.5`
- [ ] `CONFIG.cities.kingston.housingTiers` is an array of 5 objects each with `weeklyRentUsd`, `depositUsd`, `cashRequiredUsd`; tier 0 rent is `90`, tier 1 rent is `140`, tier 2 rent is `220`, tier 3 rent is `320`, tier 4 rent is `0`
- [ ] `CONFIG.cities.kingston.jobs` is an array of 4 objects each with `id`, `minCommitHours`, `hourlyWageUsd`, `lossThresholdHours`, `lossConsecutiveWeeks`; gig wage is `3.50`, part-time is `5.00`, full-time is `7.00`, skilled is `12.00`
- [ ] `CONFIG.loans.baseAprPct` equals `18`, `CONFIG.loans.minAprPct` equals `4`, `CONFIG.loans.amountTiers` contains `[500, 1000, 2500, 5000]`
- [ ] `CONFIG.businesses.types` is an array of 4 objects each with `id`, `launchCostUsd`, `weeklyIncomeUsd`, `sector`; food stall launch cost is `2000`
- [ ] `CONFIG.progression.tier1Threshold` equals `10000` and `CONFIG.progression.tier2Threshold` equals `1000000`
- [ ] `CONFIG.events.maxPerWeek` equals `2`
- [ ] All existing tests still pass (`npm test` green)

---

## SM-003: Implement energy model with burnout in step()

**Owner:** sim-engineer
**Depends on:** SM-002
**Status:** Ready

### What
The current `step()` function applies energy changes for work and hustle only. This ticket completes the energy model: adds study and side-project drain, enforces the burnout penalty (50% productivity when energy < 20), enforces the burnout_active flag (energy = 0 for 2 consecutive weeks sets flag; energy > 50 clears it), and enforces the hour cap of 40 work+hustle hours while `burnout_active` is true. The `WeekInput` type must also gain `study` and `sideProject` hour fields alongside the existing `work`, `hustle`, `rest`.

### Acceptance criteria
- [ ] `WeekInput.hours` has `study: number` and `sideProject: number` fields
- [ ] `validateInput` rejects inputs where `work + hustle + rest + study + sideProject > 100`
- [ ] When `state.energy < 20`, income from work and hustle hours is multiplied by `CONFIG.energy.burnoutProductivityMult` (0.5)
- [ ] When `state.energy <= 0` for `state.burnoutWeeks >= 2`, `state.flags.burnout_active` is set to `true`
- [ ] While `state.flags.burnout_active`, `validateInput` rejects inputs where `work + hustle > 40`
- [ ] While `state.flags.burnout_active`, energy recovery per rest hour is multiplied by `CONFIG.energy.burnoutRecoveryMult`
- [ ] When `state.energy > 50` and `state.flags.burnout_active` is true, the flag is cleared at end of week
- [ ] `state.burnoutWeeks` increments by 1 when energy reaches 0, resets to 0 when energy > 0
- [ ] Study hours drain energy at `CONFIG.energy.studyCostPerHour` per hour
- [ ] Side-project hours drain energy at `CONFIG.energy.sideProjectCostPerHour` per hour
- [ ] Unit tests cover: burnout flag sets, burnout income penalty applies, burnout clears, hour cap enforced
- [ ] All existing tests still pass (`npm test` green)

---

## SM-004: Implement skills system in step()

**Owner:** sim-engineer
**Depends on:** SM-003
**Status:** Ready

### What
Study hours must accumulate skill points. Each study hour adds 1 point to the skill nominated in the week's input. Skills then modify hustle income ceiling and loan APR. This ticket adds a `skill` field to `WeekInput.hours` (which skill to study), implements the skill increment in `step()`, and applies the two skill modifiers: hustle ceiling = min(base ceiling + 0.50 × hustle_skill, 25); effective loan APR = max(base APR - 0.25 × negotiation_skill, 4). Skill 3 in `financial` sets the flag `skill_financial_unlocked` on the state.

### Acceptance criteria
- [ ] `WeekInput.hours` has `skill: string` field indicating which skill study hours go toward; empty string means no skill
- [ ] Each week where `hours.study > 0`, `state.skills[hours.skill]` increments by `Math.floor(hours.study)` (1 point per study hour)
- [ ] `hustle` skill increases effective hustle ceiling: ceiling = min(`CONFIG.cities.kingston.hustleHourlyMaxUsd` + `CONFIG.skills.hustleWageCeilingPerPoint` × hustle_skill, `CONFIG.cities.kingston.hustleAbsoluteCeiling`)
- [ ] `negotiation` skill reduces effective loan APR when a loan is taken: APR = max(`CONFIG.loans.baseAprPct` - `CONFIG.loans.aprReductionPerSkillPoint` × negotiation_skill, `CONFIG.loans.minAprPct`)
- [ ] When `financial` skill reaches 3, `state.flags.skill_financial_unlocked` is set to `true`
- [ ] Unit tests cover: skill increments, hustle ceiling at hustle_skill 0, 10, 32, APR at negotiation_skill 0, 20, 56
- [ ] All existing tests still pass (`npm test` green)

---

## SM-005: Implement loan system

**Owner:** sim-engineer
**Depends on:** SM-004
**Status:** Ready

### What
The player must be able to take a loan. This ticket implements the full loan lifecycle: eligibility check (reputation ≥ 15, or emergency override at cash ≤ -$2,000), loan creation that appends a `Liability` to `state.liabilities`, weekly payment deduction in `step()`, and loan payoff (liability removed when `weeksRemaining` reaches 0). It also implements `netWorthUsd()` to correctly return cash + sum(asset book values) - sum(liability principals). The emergency Halima Yusuf loan bypasses the reputation gate and fires as an event (event defined in SM-009), but the loan mechanics are built here.

### Acceptance criteria
- [ ] `takeLoan(state, amount, termWeeks, rngState)` returns `[newState, error]`; error is non-null if reputation < `CONFIG.loans.minReputation` and cash > `CONFIG.loans.emergencyMinCash`
- [ ] `takeLoan` creates a `Liability` with correct `principalUsd`, `weeklyPaymentUsd` computed from APR formula in GDD section 7.4, and `weeksRemaining`
- [ ] APR used in `takeLoan` applies the negotiation skill modifier from SM-004
- [ ] In `step()`, each active liability's `weeklyPaymentUsd` is subtracted from `cashUsd`; `weeksRemaining` decrements by 1
- [ ] When `weeksRemaining` reaches 0 the liability is removed from `state.liabilities`
- [ ] `netWorthUsd(state)` returns `state.cashUsd + sum(asset.bookValueUsd) - sum(liability.principalUsd)` (principal not remaining payments, to reflect balance sheet)
- [ ] Player cannot hold more simultaneous loans than `CONFIG.loans.maxSimultaneous[wealthTier]`
- [ ] Tag `took_loan` is appended to history when a loan is taken
- [ ] Unit tests cover: loan taken at tier 0 reputation gate, weekly deduction, payoff removal, netWorthUsd with active loan
- [ ] All existing tests still pass (`npm test` green)

---

## SM-006: Implement housing system and eviction in step()

**Owner:** sim-engineer
**Depends on:** SM-005
**Status:** Ready

### What
Housing tier must be an active system: rent for the current tier is deducted automatically each week, the player can move to a higher tier if they meet the cash threshold, and the eviction mechanic fires when cash is negative for 2 consecutive weeks. This ticket adds `moveHousing(state, tier)` to validate and execute a tier change (deducting the deposit, updating `state.housingTier`), implements the `overdueWeeks` counter in `step()`, and applies the forced post-eviction repayment ($20/week deducted until debt is cleared, tracked as a separate liability).

### Acceptance criteria
- [ ] `step()` deducts `CONFIG.cities.kingston.housingTiers[state.housingTier].weeklyRentUsd` each week
- [ ] `moveHousing(state, newTier)` returns `[newState, error]`; error if `state.cashUsd < CONFIG.cities.kingston.housingTiers[newTier].cashRequiredUsd` or `state.cashUsd < deposit`
- [ ] `moveHousing` deducts the deposit from `cashUsd` and sets `state.housingTier`
- [ ] When `state.cashUsd < 0` at end of `step()`, `state.overdueWeeks` increments by 1; otherwise it resets to 0
- [ ] When `state.overdueWeeks >= 2`, `state.housingTier` is set to `0`, tag `evicted` is appended to history, `state.overdueWeeks` resets to 0, and a $20/week forced repayment liability is added for the owed rent
- [ ] Trust with `halima_yusuf` decreases by 20 when `evicted` tag is added
- [ ] Unit tests cover: rent deducted each week, eviction after 2 overdue weeks, housing upgrade accepted and rejected, post-eviction repayment liability
- [ ] All existing tests still pass (`npm test` green)

---

## SM-007: Implement wealth tier calculation and wealthTier field in step()

**Owner:** sim-engineer
**Depends on:** SM-006
**Status:** Ready

### What
`state.wealthTier` must be recalculated at the end of every `step()` call based on the current `netWorthUsd()`. Tier 0 is below $10,000; Tier 1 is $10,000 to $999,999; Tier 2 is $1,000,000 and above. Tier 2 sets `state.flags.stage2_unlocked`. The business launch action is gated by Tier 1 AND `skill_financial_unlocked`, enforced in `launchBusiness()` added this ticket. Business weekly income is added to `cashUsd` each step for all active businesses.

### Acceptance criteria
- [ ] `state.wealthTier` is recalculated every `step()` using `netWorthUsd()` and config thresholds
- [ ] `state.wealthTier` can decrease if `netWorthUsd()` drops below a threshold
- [ ] When `state.wealthTier` reaches 2, `state.flags.stage2_unlocked` is set to `true`
- [ ] `launchBusiness(state, businessTypeId)` returns `[newState, error]`; error if `state.wealthTier < 1` or `!state.flags.skill_financial_unlocked`
- [ ] `launchBusiness` deducts `launchCostUsd`, appends an `Asset` to `state.assets`, appends tag `launched_business_<typeId>` to history
- [ ] Each `step()` adds `asset.weeklyIncomeUsd` to `cashUsd` for every business asset
- [ ] Unit tests cover: tier 0 to 1 transition, tier 1 to 2 transition, tier downgrade, business launch gating, weekly business income
- [ ] All existing tests still pass (`npm test` green)

---

## SM-008: Implement event engine in step()

**Owner:** sim-engineer
**Depends on:** SM-007
**Status:** Ready

### What
The event engine must load event definitions from `/content/events/*.json`, filter them each week by trigger conditions, perform weighted random selection, and return the selected events for the caller to present to the player. Event application (`applyEvent(state, eventId, choiceIndex)`) is a separate pure function that applies a chosen effect to state. This ticket implements the engine and the application function. Events are not embedded in `step()` directly — instead `step()` returns `pendingEvents: Event[]` alongside the new state, so the UI/balance suite can present them before they are applied.

### Acceptance criteria
- [ ] `loadEvents(eventJson: unknown[])` validates each event against the JSON schema and returns `Event[]`; throws if any event fails validation
- [ ] `selectEvents(state, events, rngState)` returns `[selectedEvents: Event[], nextRngState: number]` where selected events satisfy all trigger conditions and count ≤ `CONFIG.events.maxPerWeek`
- [ ] Trigger conditions checked: `minWeek`, `maxAge`, `minCashUsd`, `maxCashUsd`, `cities`, `requiresTags`, `forbidsTags`, `once` (checked against `state.firedEvents`)
- [ ] `minYearsAfterTag` is satisfied when the tag's `week` in `state.history` is at least `minYearsAfterTag × 52` weeks before `state.week`
- [ ] Selection uses weighted random: probability of selecting event i = weight_i / sum(weights)
- [ ] `applyEvent(state, eventId, choiceIndex, events)` returns `newState` with all effects in `choices[choiceIndex].effects` applied; event id appended to `state.firedEvents`
- [ ] `applyEvent` appends a `HistoryEntry` with `action: eventId` and the choice's `addTags`
- [ ] Unit tests cover: trigger filter (all conditions), `once` suppression, weighted selection distribution (chi-squared over 1000 draws), effect application for each effect type
- [ ] All existing tests still pass (`npm test` green)

---

## SM-009: Author 40 Stage 1 events in content/events/

**Owner:** lore-writer
**Depends on:** SM-008
**Status:** Ready

### What
The event engine exists but the content files are nearly empty (only `grandmother_shoebox` exists). This ticket fills `/content/events/` with 40 Stage 1 events distributed across the 7 categories defined in GDD section 10.3: Family (6), Financial opportunity (8), Financial threat (7), Relationship (6), World clock (4), Consequence (5), Hustle/work (4). Each event must validate against `/content/schema/event.schema.json`. Consequence events must set `minYearsAfterTag` and `requiresTags` to wire up the Stage 1 consequence chains in GDD section 11. The grandmother shoebox event already counts as 1 of the 6 family events.

### Acceptance criteria
- [ ] `/content/events/` contains JSON files with a total of exactly 40 unique events across all files
- [ ] Every event passes `loadEvents()` validation (from SM-008) with zero errors
- [ ] Family category has exactly 6 events including `grandmother_shoebox`
- [ ] Financial opportunity category has exactly 8 events
- [ ] Financial threat category has exactly 7 events
- [ ] Relationship category has exactly 6 events, including at least one that sets trust for `halima_yusuf` and one for `first_partner`
- [ ] World clock category has exactly 4 events, each with a `minWeek` corresponding to a lore date in LORE.md
- [ ] Consequence category has exactly 5 events, each with both `requiresTags` and `minYearsAfterTag` set
- [ ] Hustle/work category has exactly 4 events
- [ ] The 4 canonical consequence chains from GDD section 11 are covered: `took_shady_loan`, `cut_partner_<name>`, `evicted`, `ignored_sibling_ask`
- [ ] No two events share the same `id`
- [ ] `npm run validate-content` (or equivalent content validation step) exits 0

---

## SM-010: Implement job system in step()

**Owner:** sim-engineer
**Depends on:** SM-008
**Status:** Ready

### What
The player must be able to hold a job contract that modifies their hourly wage and can be lost. This ticket adds `holdJob(state, jobId)` and `quitJob(state)` functions, and extends `step()` to: apply the job's hourly wage (instead of base gig rate) to work hours when a job is held, track under-hours weeks per job, fire job loss when the threshold is met, and enforce the full-time job cap on hustle hours. The gig-work rate is always available as a fallback with no contract.

### Acceptance criteria
- [ ] `GameState` has field `activeJobId: string | null` initialized to `null`
- [ ] `holdJob(state, jobId)` sets `state.activeJobId` and appends tag `took_job_<jobId>` to history; returns error if jobId is not in `CONFIG.cities.kingston.jobs`
- [ ] `quitJob(state)` clears `state.activeJobId` and appends tag `quit_job_<jobId>`
- [ ] In `step()`, when `activeJobId` is set, work hours earn `job.hourlyWageUsd`; otherwise they earn `CONFIG.cities.kingston.baseHourlyWageUsd`
- [ ] `GameState` has field `underHoursWeeks: number` initialized to `0`
- [ ] In `step()`, if `activeJobId` is set and `work < job.lossThresholdHours`, `underHoursWeeks` increments; otherwise it resets to 0
- [ ] When `underHoursWeeks >= job.lossConsecutiveWeeks`, job is lost: `activeJobId` set to null, tag `lost_job_<jobId>` appended, reputation reduced by `CONFIG.reputation.jobLossPenalty`
- [ ] When `activeJobId` is a full-time job and `hustle > 20`, `validateInput` returns an error
- [ ] Unit tests cover: job wage applied, job lost after threshold, gig fallback when no job, full-time hustle cap
- [ ] All existing tests still pass (`npm test` green)

---

## SM-011: Implement headless balance suite

**Owner:** balance-qa
**Depends on:** SM-010
**Status:** Ready

### What
The balance suite (`npm run balance`) must run 100 seeds with three scripted strategies and write `tests/balance/report.md`. The three strategies are: Passive (allocate 60 rest, 40 work, 0 hustle every week; never take loans; never launch businesses), Competent (allocate 20 rest, 40 work, 20 hustle, 10 study, 10 skill: hustle; take first available loan; launch food stall when eligible), Greedy (allocate 10 rest, 20 work, 60 hustle, 10 study, 0 rest reserve; take every loan; take shady deals when offered). Each strategy must be a deterministic function `(state, events) => WeekInput + eventChoice`. The report must include median and p10/p90 net worth at weeks 156, 312, and 468 for each strategy, plus greedy consequence tag rate.

### Acceptance criteria
- [ ] `npm run balance` exits 0 and writes `tests/balance/report.md`
- [ ] The report includes a table: strategy × week (156, 312, 468) × stat (median net worth, p10, p90)
- [ ] Passive median net worth at week 468 is between $10,000 and $80,000 across 100 seeds
- [ ] Competent median net worth at week 468 is between $500,000 and $2,000,000 across 100 seeds
- [ ] Greedy median net worth at week 468 is between $800,000 and $3,000,000 across 100 seeds
- [ ] At least 50% of greedy runs have at least 1 consequence tag (`took_shady_loan`, `evicted`, or `cut_partner_*`) in `state.history` at week 468
- [ ] All 100 seeds per strategy are deterministic: running the suite twice produces identical `report.md`
- [ ] The report notes any seeds where the passive strategy triggered eviction (should be < 20%)

---

## SM-012: Wire sim to phone UI — week screen and hour allocator

**Owner:** ui-engineer
**Depends on:** SM-010
**Status:** Ready

### What
The UI must display the current game state and allow the player to allocate 100 hours and advance one week. This ticket implements two screens: the Home / Week Summary screen (shows cash, energy, reputation, age, in-game date, last week's delta) and the Hour Allocator screen (allows the player to distribute 100 hours across work, hustle, rest, study, side-project; shows remaining hours; validate before confirming). On confirm, the UI calls `step()` with the input and renders the updated state. The UI stores state in localStorage via `serialize` / `deserialize`. No event cards yet.

### Acceptance criteria
- [ ] Home screen displays `state.cashUsd` formatted as USD, `state.energy` as a progress bar 0–100, `state.reputation` as a number, player age and in-game year
- [ ] Hour allocator shows 5 sliders or steppers for work, hustle, rest, study, side-project; total must equal exactly 100 to enable the Advance Week button
- [ ] Advance Week button calls `step()` and updates displayed state
- [ ] After advancing, the home screen shows the net delta for cash and energy from the previous week
- [ ] State is saved to localStorage after every `step()` call; on page load, state is restored if a save exists
- [ ] On first load with no save, `newGame(Date.now() >>> 0, 'kingston')` is called
- [ ] `npm run dev` starts without errors and the screens are navigable on a 390px viewport
- [ ] No import from `/sim` appears in the DOM event handlers themselves — all sim calls go through a thin adapter in `ui/`

---

## SM-013: Wire event cards to UI

**Owner:** ui-engineer
**Depends on:** SM-012
**Status:** Ready

### What
When `step()` returns pending events, the UI must display them as full-screen event cards before returning to the home screen. Each card shows the event channel icon, title, body text, and 2–4 choice buttons. After the player chooses, `applyEvent()` is called, state is updated and saved, and the next event card is shown (if more than one event fired this week). After all events are resolved the player returns to the home screen showing the final post-event state.

### Acceptance criteria
- [ ] After calling `step()`, if any events are returned they are displayed as cards before showing the home screen
- [ ] Each event card shows: a channel label (text / news / call / document / email / briefing), the event title, the event body, and one button per choice
- [ ] Selecting a choice calls `applyEvent(state, eventId, choiceIndex, events)` and saves the resulting state to localStorage
- [ ] If two events fire in one week, the second card is shown after the first choice is confirmed
- [ ] The player cannot skip an event (the Advance Week button is hidden while events are pending)
- [ ] On the `grandmother_shoebox` event, the channel label displays "document"
- [ ] All event text is sourced from the event JSON loaded at startup; no event text is hardcoded in the UI

---

## SM-014: Net worth tracker and history log screens

**Owner:** ui-engineer
**Depends on:** SM-013
**Status:** Ready

### What
Two secondary screens complete the vertical slice UI. The Net Worth Tracker shows a line chart of `netWorthUsd()` over all weeks played, with wealth tier thresholds ($10,000 and $1,000,000) marked as horizontal rules. The History Log shows all `HistoryEntry` items in reverse chronological order, with each entry showing its week, action string, and tag pills. These screens do not advance game state; they are read-only views.

### Acceptance criteria
- [ ] Net worth tracker renders a line chart with one data point per week played, x-axis in weeks, y-axis in USD
- [ ] Horizontal lines on the chart mark $10,000 (Tier 1 threshold) and $1,000,000 (Tier 2 / Stage 2 threshold) in a visually distinct color
- [ ] The chart updates after each week advance
- [ ] History log shows all `state.history` entries newest first, each with week number, action label, and tag chips
- [ ] History log is scrollable and renders correctly at 390px viewport width
- [ ] Both screens are reachable from the home screen via navigation and return to the home screen on back
- [ ] `npm run build` produces a deployable `dist/` with no build errors

---

## In progress

## Done

## Requested

### Fix step() return type in tests/balance/run.ts (SM-008 follow-up)
- Owner: balance-qa
- Goal: Update the balance runner to destructure `{ state }` from `step()` which now returns `{ state: GameState; pendingEvents: GameEvent[] }` instead of `GameState` directly
- Files: `tests/balance/run.ts`
- Depends on: SM-008
- Size: S
- Acceptance:
  - [ ] `npm run typecheck` passes with no errors in `tests/balance/run.ts`
  - [ ] `npm run balance` exits 0

### Fix step() return type in ui/main.ts (SM-008 follow-up)
- Owner: ui-engineer
- Goal: Update the placeholder UI to destructure `{ state }` from `step()` which now returns `{ state: GameState; pendingEvents: GameEvent[] }` instead of `GameState` directly
- Files: `ui/main.ts`
- Depends on: SM-008
- Size: S
- Acceptance:
  - [ ] `npm run typecheck` passes with no errors in `ui/main.ts`
  - [ ] `npm run build` exits 0

## Icebox
