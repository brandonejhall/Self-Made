# State

Every agent reads this first and updates it last.

## Built

- Repo scaffold: TypeScript, Vite, Vitest.
- `sim/` skeleton: types, seeded RNG, config, a `step()` that advances one week.
- One passing smoke test.
- SM-001: `Asset` and `Liability` interfaces added to `sim/types.ts`. `GameState` extended with 11 new fields: `skills`, `trust`, `assets`, `liabilities`, `firedEvents`, `housingTier`, `overdueWeeks`, `burnoutWeeks`, `wealthTier`, `activeJobId`, `underHoursWeeks`. `newGame()` initializes all to zero values. `netWorthUsd()` now sums cash + asset book values minus liability principals. Round-trip serialize test added for all new fields.

## In progress

- Nothing.

## SM-008 changes

- `sim/types.ts`: Added three new exported interfaces: `EventTrigger`, `EventChoice`, and `GameEvent`.
- `sim/index.ts` exports `loadEvents`, `selectEvents`, `applyEvent`, `GameEvent`, `EventTrigger`, `EventChoice`.
- `sim/index.ts` `step()` signature changed: now accepts an optional third parameter `events: GameEvent[] = []` (default keeps all existing callers working without modification) and returns `{ state: GameState; pendingEvents: GameEvent[] }` instead of `GameState`. After computing the final state, `selectEvents` is called; the rngState returned from event selection is stored back in the returned state.
- `sim/index.ts` `loadEvents(eventJsonArray: unknown[]): GameEvent[]`: validates required fields (`id` matching `^[a-z0-9_]+$`, integer `stage`, string `title`, string `body`, object `trigger`, array of 2–4 choices each with `label` and `effects`). Throws with the event id (or index) in the error message on the first failing event.
- `sim/index.ts` `selectEvents(state, events, rngState): [GameEvent[], number]`: filters by all trigger conditions (minWeek, minAge, maxAge, minCashUsd, maxCashUsd, cities, requiresTags, forbidsTags, once, minYearsAfterTag), then picks up to `CONFIG.events.maxPerWeek` events by weighted random draw without replacement using `nextRandom`.
- `sim/index.ts` `applyEvent(state, eventId, choiceIndex, events): GameState`: applies cashUsd (round2), energy (clamp 0–100), reputation (clamp 0–100), trust (merge-add), setFlags (true), addTags (new HistoryEntry with week/action/tags), and appends eventId to firedEvents. Pure — no mutation of input.
- All existing tests in `tests/sim/` updated to destructure `{ state }` from `step()` calls. Loop reassignments use `.state` suffix (e.g. `s = step(s, week).state`).
- `tests/sim/events.test.ts` added with 39 tests covering all acceptance criteria.
- `docs/BACKLOG.md` "Requested" section: two tickets added for balance-qa and ui-engineer to fix the step() return type in their placeholder files (`tests/balance/run.ts` and `ui/main.ts`) — both files are outside sim-engineer ownership and cannot be edited here.

## SM-007 changes

- `sim/index.ts` `step()`: passive business income added before computing `newCashAfterAll`. All `asset.weeklyIncomeUsd` values are summed and included in `income` each week (assets without `weeklyIncomeUsd` contribute 0 via `?? 0`).
- `sim/index.ts` `step()`: `wealthTier` recalculated at the end of `step()` from the fully-updated state's net worth using new `computeWealthTier(nw)` helper. `stage2_unlocked` flag is set in `flags` when `newWealthTier >= 2`.
- `sim/index.ts` exports new `launchBusiness(state, businessTypeId): [GameState, string | null]`:
  - Returns error when `wealthTier < 1`.
  - Returns error when `skill_financial_unlocked` flag is false.
  - Returns error for unknown `businessTypeId`.
  - Returns error when `cashUsd < bizType.launchCostUsd`.
  - On success: deducts `launchCostUsd` from cash, appends `Asset` with `id = biz_<type>_<week>`, `bookValueUsd = launchCostUsd`, `weeklyIncomeUsd = bizType.weeklyIncomeUsd`, appends history entry with tag `launched_<businessTypeId>`.
- `tests/sim/wealth.test.ts` added with 16 tests covering all acceptance criteria.

## SM-006 changes

- `sim/index.ts` `step()`: rent line updated to use `CONFIG.cities.kingston.housingTiers[state.housingTier]!.weeklyRentUsd` instead of the placeholder tier-0 constant (removes the TODO comment).
- `sim/index.ts` `step()`: eviction logic added after loan processing. After computing `newCashAfterAll`:
  - If `newCashAfterAll < CONFIG.progression.overdueCashFloor` (0), `overdueWeeks` increments; otherwise resets to 0.
  - If `overdueWeeks >= CONFIG.progression.evictionOverdueCount` (2): `housingTier` resets to 0, `overdueWeeks` resets to 0, an `evicted` history entry is appended, `trust['halima_yusuf']` decreases by 20, and a forced repayment `Liability` (`eviction_repay_<week>`, principal = 2 weeks back-rent, $20/week) is added to `liabilities`.
  - `step()` now returns `overdueWeeks`, `housingTier`, `trust`, `history`, and `liabilities` with these updated values.
- `sim/index.ts` exports new `moveHousing(state, newTier): [GameState, string | null]`:
  - Returns error when `newTier` is out of bounds.
  - Returns error when `cashUsd < cashRequiredUsd` for the target tier.
  - Returns error when `cashUsd < depositUsd` for the target tier.
  - On success: deducts deposit, sets `housingTier = newTier`, returns new state.
- `tests/sim/housing.test.ts` added with 17 tests covering all acceptance criteria.

## SM-005 changes

- `sim/index.ts` exports `takeLoan(state, amount, termWeeks): [GameState, string | null]`:
  - Returns `[state, errorString]` on failure (reputation < 15 unless cash <= -2000 emergency override, or already at maxSimultaneous loan count for the wealth tier).
  - On success: adds the loan amount to `cashUsd`, appends a `Liability` to `liabilities`, and appends a history entry with tag `took_loan`.
  - Weekly payment computed with amortization formula: `(principal * weeklyRate) / (1 - (1 + weeklyRate)^(-termWeeks))`, rounded to nearest cent. Zero-APR fallback uses even division.
  - Liability id format: `loan_<week>_<amount>`.
- `sim/index.ts` `step()` updated: each active loan's `weeklyPaymentUsd` is summed into `loanPayments` and deducted from cash alongside rent and living costs. `weeksRemaining` is decremented; liabilities with `weeksRemaining === 0` are removed.
- `tests/sim/loans.test.ts` added with 16 tests covering all acceptance criteria.

## SM-004 changes

- `sim/types.ts`: `study`, `sideProject`, and `skill` in `WeekInput.hours` are now optional (defaulting to `0`, `0`, and `""` in `step()`). This preserves backward compatibility with `tests/balance/run.ts` and `ui/main.ts` which were not updated when SM-003 added those fields.
- `sim/index.ts` `step()` updated:
  - Skill increment: if `study > 0` and `skill !== ""`, `Math.floor(study)` is added to `state.skills[skill]`.
  - Financial unlock: every step, if `newSkills['financial'] >= CONFIG.skills.financialBusinessUnlockLevel` (3), `flags.skill_financial_unlocked` is set to `true`.
  - Hustle ceiling: effective ceiling = `min(city.hustleHourlyMaxUsd + CONFIG.skills.hustleWageCeilingPerPoint * state.skills['hustle'], city.hustleAbsoluteCeiling)`. Uses skills at the START of the week (not post-increment) so the boost takes effect the following week.
  - Reputation modifier on hustle rate: `repDelta = state.reputation - 50`; above 50 adds `1% * repDelta`; below 50 subtracts `0.5% * |repDelta|`.
  - `skills: newSkills` is now returned in the new state object.
- `sim/index.ts` exports two new helpers:
  - `effectiveLoanApr(state)`: returns `max(baseAprPct - negotiation * aprReductionPerSkillPoint, minAprPct)`. Needed by SM-005.
  - `effectiveHustleCeiling(state)`: returns the skill-modified hustle rate ceiling for the player's current city.
- `tests/sim/skills.test.ts` added with 15 tests covering all acceptance criteria.
- `tests/sim/smoke.test.ts` and `tests/sim/energy.test.ts` updated: `skill: ""` added to WeekInput fixtures.

## SM-002 changes

- `sim/config.ts` extended with full Stage 1 economy: energy burnout parameters, `housingTiers` (5 tiers), `jobs` (4 entries), `loans`, `businesses`, `skills`, `reputation`, `progression`, and `events` blocks.
- Removed top-level `weeklyRentUsd` from `cities.kingston`; rent now lives in `housingTiers[n].weeklyRentUsd`.
- `sim/index.ts` `step()` updated: `city.weeklyRentUsd` replaced with `CONFIG.cities.kingston.housingTiers[0].weeklyRentUsd` as a placeholder pending SM-006 (housing system).
- `tests/sim/config.test.ts` added with 15 tests covering every acceptance criterion.

## Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-11-09 | Sim is pure TypeScript with a seeded RNG | Headless balance runs must reproduce exactly |
| 2026-11-09 | Content is JSON in `/content` | Lore-writer works without touching code |
| 2026-11-09 | Vertical slice is Kingston, Stage 1 only | Prove the core loop before building scale |
| 2026-11-09 | GDD written covering all Stage 1 systems | Full spec needed before sim tickets can be sequenced |
| 2026-11-09 | 14 vertical slice tickets written (SM-001 to SM-014) | Ordered sim-first; each ticket is S or M; covers full loop from state types through balance suite through UI |
| 2026-11-09 | study and sideProject added to WeekInput | GDD section 4 defines them as action slots; needed for skill system |
| 2026-11-09 | Event engine returns pendingEvents from step() rather than applying events inside step() | UI and balance suite must resolve event choices before state advances; embedding inside step() would require passing choice functions into the sim |
| 2026-11-09 | Kingston wages denominated in USD at fixed 155 JMD/USD exchange rate for Stage 1 | Multi-currency is Stage 2 scope; fixed rate keeps Stage 1 sim pure |
| 2026-11-09 | netWorthUsd() updated to include asset book values minus liability principals | Provides correct net worth calculation once assets and liabilities are populated by Stage 1 systems |
| 2026-11-09 | Rent moved from city top-level to housingTiers array | GDD specifies 5 housing tiers; SM-006 will wire state.housingTier to the correct array index |
| 2026-11-09 | WeekInput.hours optional fields (study, sideProject, skill) | balance/run.ts and ui/main.ts were not updated in SM-003; making fields optional avoids breaking those files while keeping step() deterministic |
| 2026-11-09 | Hustle ceiling uses state.skills (not newSkills) | Skills earned this week take effect next week; consistent with "you plan based on what you know at the start of the week" |
| 2026-11-09 | takeLoan is a standalone function, not embedded in step() | Loans are player-initiated decisions, not automatic weekly events; keeping it outside step() preserves the pure (state, input) -> newState contract |
| 2026-11-09 | Loan id uses week+amount composite | Deterministic, human-readable, unique within a typical game run |
| 2026-11-09 | wealthTier computed at end of step() from final net worth | Ensures tier reflects all changes in the week (income, costs, eviction liabilities) before persisting; tier can increase or decrease each week |
| 2026-11-09 | launchBusiness is a standalone function outside step() | Business launch is a player-initiated action; keeping it outside step() preserves the pure weekly-advance contract |
| 2026-11-09 | Tier 2 test cash set to $1,001,000 not $1,000,000 | Weekly costs ($150 rent+living) would drop net worth below threshold after one step; test must account for this to remain deterministic |
| 2026-11-09 | step() returns { state, pendingEvents } instead of GameState | UI and balance suite must resolve event choices before state advances; embedding inside step() would require passing choice functions into the sim |
| 2026-11-09 | selectEvents advances rngState; final rngState stored in returned state | Ensures full determinism: event selection consumes seeded entropy, so identical inputs always produce identical pending events |
| 2026-11-09 | loadEvents uses lightweight field-by-field validation rather than a JSON Schema library | Keeps sim/ free of heavy runtime dependencies; the schema file already serves as documentation |
| 2026-11-09 | applyEvent adds history entry only when addTags is defined in effects | An entry with empty tags adds noise to history; undefined addTags means the choice intentionally has no tagging effect |
