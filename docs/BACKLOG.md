# Backlog

The pm agent owns this file. Other agents add items only under "Requested".

## Tracks

| Sprint | Tickets | Run mode |
|---|---|---|
| A | SM-015 | Alone. Must merge before Sprint B starts. |
| B | SM-016, SM-017, SM-018, SM-019, SM-022 | Parallel worktrees |
| C | SM-020, then SM-021, then `/autotune` | Sequential |

Spec references: GDD sections 8.4 (business growth), 9.1 (property), 11 (shady tags, delayed consequences), 12 (balance targets), 15.1 (summary), 17 (exit criteria).

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

### SM-015: Split sim/index.ts into system modules
- Owner: sim-engineer
- Goal: Move each Stage 1 system out of `sim/index.ts` into `sim/systems/<system>.ts`, with `step()` as a fixed-order pipeline and zero behavior change.
- Files: `sim/index.ts`, `sim/systems/energy.ts`, `sim/systems/skills.ts`, `sim/systems/jobs.ts`, `sim/systems/loans.ts`, `sim/systems/housing.ts`, `sim/systems/business.ts`, `sim/systems/tiers.ts`, `sim/systems/events.ts`, plus one module per other system found in `step()` (for example `sim/systems/income.ts`), `tests/sim/golden.test.ts`
- Depends on: none
- Size: M
- Acceptance:
  - [ ] `tests/sim/golden.test.ts` is written and committed BEFORE any code moves. It runs seed 42, `holdJob("full_time")` at week 0, input `{ work: 40, hustle: 10, rest: 50, study: 0, sideProject: 0, skill: "" }` every week, all `content/events/*.json` loaded via `loadEvents`, every pending event resolved with choice 0 via `applyEvent`, for 468 steps.
  - [ ] The golden test asserts the exact final `week`, `cashUsd`, `energy`, `reputation`, `rngState`, `history.length`, `firedEvents.length`, and the full `serialize(state)` string (or an FNV-1a 32-bit hash of it computed in the test), all recorded from the pre-refactor code.
  - [ ] The golden test passes unchanged after the refactor.
  - [ ] Every module in `sim/systems/` exports pure functions only. No module imports from `/ui`, touches `window`, `localStorage`, `Date.now()` or `Math.random()`.
  - [ ] `step()` in `sim/index.ts` calls the system modules in one fixed order, written as a single ordered list in the function body, with a comment listing the order.
  - [ ] Every symbol `sim/index.ts` exported before the refactor is still exported from `sim/index.ts` with the same signature (`newGame`, `validateInput`, `step`, `takeLoan`, `moveHousing`, `launchBusiness`, `holdJob`, `quitJob`, `loadEvents`, `selectEvents`, `applyEvent`, `effectiveLoanApr`, `effectiveHustleCeiling`, `netWorthUsd`, `serialize`, `deserialize`, `CONFIG` and all re-exported types).
  - [ ] All existing tests in `tests/sim/` pass without edits.
  - [ ] `npm test` and `tsc --noEmit` are green.
  - [ ] STATE.md records the pipeline order. Later tickets that intentionally change behavior must re-record golden values and state so in STATE.md.

### SM-016: Rental property system
- Owner: sim-engineer
- Goal: Let the player buy, rent out and sell Kingston rental properties with a mortgage, per GDD section 9.1.
- Files: `sim/systems/property.ts`, `sim/index.ts`, `sim/config.ts`, `sim/types.ts`, `tests/sim/property.test.ts`, `tests/sim/golden.test.ts`
- Depends on: SM-015
- Size: M
- Acceptance:
  - [ ] `CONFIG.property` contains every key in GDD section 14 prefixed `property.` with the GDD values, and `property.types` holds `kgn_studio` ($30,000, $60/week), `kgn_two_bed` ($65,000, $120/week), `kgn_house` ($150,000, $260/week).
  - [ ] `buyProperty(state, propertyTypeId, downPaymentUsd, termWeeks)` returns `[GameState, string | null]` and is exported from `sim/index.ts`.
  - [ ] `buyProperty` returns an error and the unchanged state when: `wealthTier < 1`; unknown type id; `downPaymentUsd < 0.20 × price`; `downPaymentUsd > price`; `termWeeks` not in [520, 1040] while a mortgage is needed; `cashUsd < downPaymentUsd + 0.03 × price`; 3 properties already owned.
  - [ ] On success for `kgn_studio` with $6,000 down and 1040 weeks: cash drops by $6,900; one `Asset` with `kind: "property"`, `bookValueUsd: 30000`, occupied; one `Liability` with `kind: "mortgage"`, `principalUsd: 24000`, `propertyId` equal to the asset id, weekly payment from the GDD 7.4 formula at 9% APR; history tag `bought_kgn_studio`.
  - [ ] A $30,000 down payment on `kgn_studio` creates no liability.
  - [ ] Each `step()`: an occupied property adds its weekly rent to cash; every property charges `bookValueUsd × 0.01 / 52`; each mortgage charges its weekly payment and reduces principal by payment minus `principal × 0.09 / 52`.
  - [ ] With the vacancy draw forced below 0.015 (test via a crafted `rngState`), the property is vacant for exactly 6 steps, pays no rent during them, and is occupied again on step 7.
  - [ ] After 52 steps from purchase, `bookValueUsd` equals `round2(price × 1.04)`. After 104 steps, `round2(round2(price × 1.04) × 1.04)`.
  - [ ] `sellProperty(state, assetId)` adds `bookValueUsd × 0.95 − remaining principal` to cash, removes the asset and its mortgage, adds tag `sold_property`. Unknown asset id returns an error.
  - [ ] `netWorthUsd()` includes property book value and subtracts mortgage principal.
  - [ ] Each mortgage payment is charged exactly once per step. A test with 1 mortgage and no other liability asserts cash change = rent − maintenance − payment − rent for housing tier − living costs.
  - [ ] Property rent is not counted through the business `weeklyIncomeUsd` sum. A test with 1 occupied property and 0 businesses asserts rent is added once.
  - [ ] Mortgages do not count toward `loans.maxSimultaneous`. A tier 1 player with 1 mortgage can still take 2 loans.
  - [ ] `serialize`/`deserialize` round-trips a state holding 1 vacant and 1 occupied property with mortgages.
  - [ ] Golden test values re-recorded only if the golden run changes; STATE.md notes the reason.

### SM-017: Business growth stages
- Owner: sim-engineer
- Goal: Businesses grow through 4 stages via reinvestment and time, and can fail, per GDD section 8.4.
- Files: `sim/systems/business.ts`, `sim/index.ts`, `sim/config.ts`, `sim/types.ts`, `tests/sim/business.test.ts`, `tests/sim/golden.test.ts`
- Depends on: SM-015
- Size: M
- Acceptance:
  - [ ] `CONFIG.businesses.stages` holds 4 entries: incomeMult 1, 2, 4, 8; minWeeksToEnter 0, 26, 52, 78; reinvestToEnterUsd 0, 5000, 20000, 60000; weeklyFailureChance 0.003, 0.0015, 0.001, 0.0005. `burnoutFailureMult = 2`, `failureReputationPenalty = 5`.
  - [ ] `launchBusiness` creates an asset with `kind: "business"`, `stage: 1`, `weeksAtStage: 0`, `reinvestedAtStageUsd: 0`. Existing `tests/sim/wealth.test.ts` passes unchanged.
  - [ ] `reinvestBusiness(state, assetId, amountUsd)` returns `[GameState, string | null]`, is exported from `sim/index.ts`, and on success deducts cash and adds `amountUsd` to both `reinvestedAtStageUsd` and `bookValueUsd`.
  - [ ] `reinvestBusiness` returns an error for: unknown asset id; non-business asset; `amountUsd <= 0`; `cashUsd < amountUsd`; stage 4 business.
  - [ ] A food stall with $5,000 reinvested advances to stage 2 on the step where `weeksAtStage` reaches 26, and not before. Its `weeklyIncomeUsd` becomes $360. History tag `grew_food_stall_stage2`.
  - [ ] A food stall at 26 weeks with $4,999.99 reinvested stays at stage 1.
  - [ ] A business advances at most 1 stage per step.
  - [ ] With the failure draw forced below 0.003 (crafted `rngState`), a stage 1 business is removed, tag `lost_business_<type>` is added and reputation drops by 5, clamped at 0.
  - [ ] With energy < 20, a draw of 0.005 fails a stage 1 business (doubled chance 0.006); with energy ≥ 20 the same draw does not.
  - [ ] `serialize`/`deserialize` round-trips a stage 3 business with partial reinvestment.
  - [ ] Golden test values re-recorded only if the golden run changes; STATE.md notes the reason.

### SM-018: Shortcut events and delayed follow-ups
- Owner: lore-writer
- Goal: Give every run shady or shortcut choices that pay more now and come back 1 to 4 years later.
- Files: `content/events/stage1_shortcut.json`, `content/events/stage1_shortcut_consequence.json`, `content/tags.json`, `content/schema/tags.schema.json`
- Depends on: none
- Size: M
- Acceptance:
  - [ ] `content/tags.json` contains a `shadyTags` array with at least: `took_shady_loan`, `took_loan_shark`, `cash_deal_shady`, `cut_out_partner`, `cut_partner_first`, `skipped_permit`, `undeclared_income`. It validates against `content/schema/tags.schema.json`.
  - [ ] `stage1_shortcut.json` holds 8 to 10 events. Topics covered at least once each: cash deal, cutting out a partner, skipping a permit, loan-shark money.
  - [ ] Every shortcut event has exactly 1 or 2 shady choices (choice `addTags` contains a shady tag) and at least 1 non-shady choice.
  - [ ] In every shortcut event, each shady choice has a strictly higher `cashUsd` effect than every non-shady choice in that event.
  - [ ] Every shortcut event has `cities` including `kingston`, `minWeek` between 26 and 208 inclusive, `weight >= 15`, and `once: true`.
  - [ ] `stage1_shortcut_consequence.json` holds at least 3 events. Each has `requiresTags` with one shady tag used in `stage1_shortcut.json`, `minYearsAfterTag` between 1 and 4 inclusive, `weight >= 30`, and `once: true`.
  - [ ] Every consequence event has at least 1 choice with `cashUsd <= -500` or `reputation <= -10`.
  - [ ] All event text follows `docs/LORE.md`. No event contradicts a LORE.md character, place or date.
  - [ ] `npm run validate` passes. Total event count is 51 to 53.

### SM-019: Balance strategies resolve event choices
- Owner: balance-qa
- Goal: Make each balance strategy resolve pending events by its own rule and report the CONCEPT balance metrics over 300 seeds.
- Files: `tests/balance/run.ts`, `tests/balance/strategies.ts`, `tests/balance/strategies.test.ts`, `tests/balance/report.md`
- Depends on: none (uses `step`, `applyEvent`, `loadEvents`, `netWorthUsd` as they exist; reads `content/tags.json` if present, else falls back to the GDD section 11 list)
- Size: M
- Acceptance:
  - [ ] Each strategy resolves every pending event every week via `applyEvent` before the next `step()`.
  - [ ] Greedy picks the choice with the highest `effects.cashUsd` (missing = 0), shady choices included. Ties go to the lowest index.
  - [ ] Competent excludes shady choices (any `addTags` entry in `shadyTags`), then picks the highest score `cashUsd + 100 × reputation + 50 × sum(trust deltas)`. Ties go to the lowest index. If every choice is shady, it picks the highest score anyway.
  - [ ] Passive excludes shady choices, then picks the smallest `|cashUsd|`. Ties go to the lowest index.
  - [ ] Unit tests cover each picker on a fixture event with 3 choices (1 shady high-cash, 1 safe mid-cash, 1 safe zero-cash) and assert indices: greedy = shady, competent = safe mid-cash, passive = zero-cash.
  - [ ] The runner uses seeds 0 to 299 for each strategy.
  - [ ] `report.md` adds per strategy: median age at first $1M (1 decimal, or "not reached" per GDD section 12) and the share of runs reaching $1M by week 468.
  - [ ] `report.md` adds the greedy delayed-consequence fire rate: runs with ≥ 1 fired event whose trigger sets `minYearsAfterTag`, over 300.
  - [ ] `report.md` adds a table of every delayed consequence event id fired across all 900 runs: fire count and median delay in weeks from first matching tag to fire.
  - [ ] `report.md` adds a pass/fail line per GDD section 12 target.
  - [ ] If a sim API for choice resolution is missing, the ticket adds a request under "Requested" in BACKLOG.md and uses what exists.

### SM-020: End the run at week 468 with a summary
- Owner: sim-engineer
- Goal: The run stops at age 30 and the state carries the data the summary screen needs, per GDD section 15.1.
- Files: `sim/systems/tiers.ts` or `sim/systems/endOfRun.ts`, `sim/systems/events.ts`, `sim/index.ts`, `sim/config.ts`, `sim/types.ts`, `tests/sim/endOfRun.test.ts`, `tests/sim/golden.test.ts`
- Depends on: SM-016, SM-017
- Size: M
- Acceptance:
  - [ ] `CONFIG.progression.stage1EndWeek = 468` and `CONFIG.progression.summaryTopChoices = 5`.
  - [ ] `GameState` gains `stage1Complete: boolean` (false in `newGame`), `summary: Stage1Summary | null` (null in `newGame`), `choiceLog: { week, eventId, choiceIndex, netWorthDeltaUsd }[]` (empty in `newGame`), `maxWealthTier: number` (0 in `newGame`).
  - [ ] `applyEvent` appends one `choiceLog` entry with `netWorthDeltaUsd = netWorthUsd(after) − netWorthUsd(before)`.
  - [ ] After 467 steps `stage1Complete` is false. After step 468 it is true and `summary` is set.
  - [ ] `summary.finalNetWorthUsd` equals `netWorthUsd(state)` at week 468.
  - [ ] `summary.wealthTierReached` equals the highest `wealthTier` held at any step, including a run that reaches tier 2 and drops back.
  - [ ] `summary.topChoices` holds the 5 `choiceLog` entries with the largest `|netWorthDeltaUsd|`, sorted descending, ties by earlier week. With 3 entries it holds 3.
  - [ ] `summary.consequencesFired` lists, in firing order, every fired event id whose trigger sets `minYearsAfterTag`, using the events passed to `step()`.
  - [ ] `step()` on a state with `stage1Complete = true` throws `"Stage 1 is complete"`.
  - [ ] Reaching $1M before week 468 sets `stage2_unlocked` and does not end the run.
  - [ ] `serialize`/`deserialize` round-trips a completed state with a summary.

### SM-021: Age-30 summary screen
- Owner: ui-engineer
- Goal: Show the SM-020 summary when the run ends and let the player start a new run.
- Files: `ui/main.ts`, `ui/style.css`
- Depends on: SM-020
- Size: S
- Acceptance:
  - [ ] When `state.stage1Complete` is true after a step or on load, the UI routes to `screen-summary` and hides the Advance Week control.
  - [ ] The screen shows final net worth, tier reached, up to 5 top choices (week, event title, net worth delta) and the list of consequence event titles fired.
  - [ ] Event titles come from the loaded event JSON by id, not hardcoded.
  - [ ] A New run button clears the `localStorage` save and net worth history, calls `newGame(Date.now() >>> 0, "kingston")` and routes to Home at week 0 with $2,000.
  - [ ] Reloading the browser on a completed run shows the summary screen again.
  - [ ] `npm run build` is clean. Layout fits a 390px wide viewport with no horizontal scroll.

### SM-022: Playable CLI with events and actions
- Owner: sim-engineer
- Goal: `npm run play` lets a human play the full Stage 1 loop in the terminal, including events, loans, businesses and property.
- Files: `cli/play.ts`, `cli/commands.ts`, `tests/sim/cli.test.ts`
- Depends on: SM-015
- Size: M
- Acceptance:
  - [ ] `cli/commands.ts` exports a pure `parseCommand(line: string)` returning a typed command or an error string, and a pure `runCommand(state, command, events)` returning the new state and output text. `cli/play.ts` only handles stdin/stdout.
  - [ ] After each week, every pending event prints with its title, body and choices numbered from 1. Entering a number in range calls `applyEvent`. An out-of-range or non-numeric entry prints an error and re-prompts.
  - [ ] Commands exist for every player action exported by `sim/index.ts` at merge time: hour allocation, `takeLoan`, `holdJob`, `quitJob`, `moveHousing`, `launchBusiness`, and `buyProperty`, `sellProperty`, `reinvestBusiness` when present.
  - [ ] A sim error string from any action prints unchanged and leaves the state unchanged.
  - [ ] A `status` command prints week, age, cash, energy, reputation, net worth, wealth tier, assets and liabilities.
  - [ ] `npm run play -- 42` produces identical output for identical scripted stdin on two runs.
  - [ ] Tests cover `parseCommand` for every command plus 3 malformed inputs, and `runCommand` for 1 event resolution and 1 failed action.

---

## In progress

---

## Done

### SM-001 through SM-012 (all completed 2026-11-09)

See `docs/STATE.md` for detailed change logs per ticket.

| Ticket | Title | Owner |
|---|---|---|
| SM-001 | Extend GameState with skills, trust, assets, liabilities, firedEvents | sim-engineer |
| SM-002 | Extend sim/config.ts with full Stage 1 economy numbers | sim-engineer |
| SM-003 | Implement energy model with burnout in step() | sim-engineer |
| SM-004 | Implement skills system in step() | sim-engineer |
| SM-005 | Implement loan system | sim-engineer |
| SM-006 | Implement housing system and eviction in step() | sim-engineer |
| SM-007 | Implement wealth tier calculation and wealthTier field in step() | sim-engineer |
| SM-008 | Implement event engine in step() | sim-engineer |
| SM-009 | Author 40 Stage 1 events in content/events/ | lore-writer |
| SM-010 | Implement job system in step() | sim-engineer |
| SM-011 | Implement headless balance suite | balance-qa |
| SM-012 | Wire sim to phone UI — week screen and hour allocator | ui-engineer |
| SM-013 | Wire event cards to UI | ui-engineer |
| SM-014 | Net worth tracker and history log screens | ui-engineer |

---

## Requested

## Icebox
