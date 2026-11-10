# State

Every agent reads this first and updates it last.

## Built

- Repo scaffold: TypeScript, Vite, Vitest.
- `sim/` skeleton: types, seeded RNG, config, a `step()` that advances one week.
- One passing smoke test.
- SM-001: `Asset` and `Liability` interfaces added to `sim/types.ts`. `GameState` extended with 11 new fields: `skills`, `trust`, `assets`, `liabilities`, `firedEvents`, `housingTier`, `overdueWeeks`, `burnoutWeeks`, `wealthTier`, `activeJobId`, `underHoursWeeks`. `newGame()` initializes all to zero values. `netWorthUsd()` now sums cash + asset book values minus liability principals. Round-trip serialize test added for all new fields.

## SM-009 changes

- `content/events/stage1_family.json`: added 5 new events (`sibling_money_ask`, `family_funeral_contribution`, `aunt_pressure_home`, `uncle_tip_plot`, `grandmother_land_dispute`) to the existing `grandmother_shoebox` event. Total: 6 family events.
- `content/events/stage1_financial_opportunity.json`: 8 new events covering a loan offer from Halima (`halima_loan_offer`), neighbour stock tip, laptop resale, Partner hand savings scheme, Western Union float hustle, shoe flip, neighbourhood paint contract, and a skills-gated bookkeeping offer (`skills_gated_bookkeeping`) gated on the `learned_market_finance` tag.
- `content/events/stage1_financial_threat.json`: 7 new events — phone scam, market theft at Papine, medical bill from UHWI, bad debt from Desmond, failed food hustle, roof repair, and sibling hospital emergency.
- `content/events/stage1_relationship.json`: 6 new events — meeting Halima (`meet_halima`), meeting the first partner at the Quad (`first_partner_meet`), Halima advice visit, partner salon deposit ask, community landlord-tenant dispute, and a direction conflict with the partner that includes the `cut_partner_first` tag option.
- `content/events/stage1_world_clock.json`: 4 new events at weeks 1, 96, 208, 365 — gig economy shock, Papine Traders' Collective opening, Caribbean property price shift, JPS solar rollout.
- `content/events/stage1_consequence.json`: 5 new events, all with `requiresTags` and `minYearsAfterTag` — debt collector (`took_shady_loan`, 2 years), ex-partner competitor (`cut_partner_first`, 3 years), insurance block (`evicted`, 1 year), sibling second ask (`ignored_sibling_ask`, 1 year), loan refinance (`took_loan`, 1 year).
- `content/events/stage1_hustle_work.json`: 4 new events — DataProc data entry job offer, Halima's Thursday market tip (sets `learned_market_finance` tag for bookkeeping gate), DataProc workplace confrontation, PinkStar weekend delivery gig.
- Total events: 40. All pass `npx tsx content/validate.ts`.

## In progress

- Nothing.

## SM-010 changes

- `sim/index.ts` exports two new functions:
  - `holdJob(state, jobId): [GameState, string | null]`: looks up the job id in `CONFIG.cities.kingston.jobs`; returns error for unknown ids; on success sets `activeJobId = jobId`, resets `underHoursWeeks = 0`, appends `took_job_<id>` history entry with matching tag.
  - `quitJob(state): [GameState, string | null]`: returns error if `activeJobId` is null; on success clears `activeJobId = null`, resets `underHoursWeeks = 0`, appends `quit_job_<id>` history entry.
- `sim/index.ts` `validateInput()`: added full-time hustle cap — when `state.activeJobId` is set and the job's `minCommitHours >= 40`, hustle > 20 is rejected with `'Full-time job limits hustle to 20 hours per week'`.
- `sim/index.ts` `step()`: work income now uses job wage — `jobWage` is resolved from the held job's `hourlyWageUsd` (or `city.baseHourlyWageUsd` if no job is held). The `workHustleIncome` formula uses `jobWage` instead of `city.baseHourlyWageUsd`.
- `sim/index.ts` `step()`: job under-hours tracking and loss added after the eviction block:
  - If a job is held and `job.lossConsecutiveWeeks > 0`, `underHoursWeeks` increments when `work < job.lossThresholdHours`, resets to 0 otherwise.
  - When `underHoursWeeks >= job.lossConsecutiveWeeks`: `lost_job_<id>` history entry is appended, `reputation` is reduced by `CONFIG.reputation.jobLossPenalty` (clamped to 0), `activeJobId` and `underHoursWeeks` are reset to null/0.
  - Gig job (`lossConsecutiveWeeks = 0`) is never lost regardless of work hours.
  - `reputation`, `activeJobId`, and `underHoursWeeks` are now mutable `let` variables in `step()` and are included in the returned state.
- `tests/sim/jobs.test.ts` added with 28 tests covering all acceptance criteria.

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

## SM-012 changes

- `ui/main.ts`: Full phone UI. Two screens: Home (cash, energy bar, rep/age/year/week stats, cash+energy delta from previous week) and Hour Allocator (5 stepper fields: work/hustle/rest/study/side-project, skill selector, Advance Week button disabled until total = 100). `advanceWeek()` sends all 6 `WeekInput` fields and destructures `{ state: newState }` from `step()`. Save/load via `serialize`/`deserialize` to localStorage. First load calls `newGame(Date.now() >>> 0, 'kingston')`.
- `ui/style.css`: Mobile-first dark theme. max-width 390px, 16px gutter. Energy bar with green/yellow/red threshold coloring via CSS classes. Stepper buttons, hour inputs with native spinner hidden, skill select.
- Events are not shown yet — `step()` is called with `events = []` pending SM-013.

## SM-011 changes

- `tests/balance/run.ts`: Headless balance runner. Loads all 7 event JSON files via `loadEvents()`. Three strategies: passive (full-time job, 40 work + 60 rest, no hustle/loans/businesses), competent (balanced work/hustle/study, skilled job, one $2500/52wk loan, food stall + delivery), greedy (financial study week 1, energy-neutral work=35+hustle=15+rest=50, all businesses, 52-week loans). 100 seeds each. Snapshots at weeks 156, 312, 468. Writes `tests/balance/report.md`.
- Balance results: passive W468 median $62,400 ✓ ($10K–$80K). Competent W468 median $356,269 (misses $500K–$2M target). Greedy W468 median $413,807 (misses $800K–$3M target). Greedy consequence rate 0% (misses ≥50% target). Gaps documented in report notes and SM-015 ticket added to Requested.

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
| 2026-11-09 | Passive strategy switched from 20hrs part-time to 40hrs full-time in balance suite | Part-time 20hrs ($100/week) < $150 living costs → death spiral; full-time 40hrs ($280/week) → +$130/week net |
| 2026-11-09 | Greedy strategy uses energy-neutral hours (work=35+hustle=15+rest=50) in balance suite | Aggressive hours (work=40+hustle=20+rest=40) drain energy faster than recovery → burnout in 4 weeks → income halved → death spiral |
| 2026-11-09 | Balance targets for competent and greedy not met; SM-015 ticket created | Missing mechanics: property appreciation, business growth events, higher-tier investments. Targets assume future systems |
