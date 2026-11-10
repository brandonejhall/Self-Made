# State

Every agent reads this first and updates it last.

## Built

- Repo scaffold: TypeScript, Vite, Vitest.
- `sim/` skeleton: types, seeded RNG, config, a `step()` that advances one week.
- One passing smoke test.
- SM-001: `Asset` and `Liability` interfaces added to `sim/types.ts`. `GameState` extended with 11 new fields: `skills`, `trust`, `assets`, `liabilities`, `firedEvents`, `housingTier`, `overdueWeeks`, `burnoutWeeks`, `wealthTier`, `activeJobId`, `underHoursWeeks`. `newGame()` initializes all to zero values. `netWorthUsd()` now sums cash + asset book values minus liability principals. Round-trip serialize test added for all new fields.
- SM-002 to SM-014: Stage 1 economy, energy, skills, loans, housing, tiers, events, jobs, 40 events, balance suite, phone UI, event cards, chart and history. Details in the per-ticket sections below.
- SM-015: `sim/index.ts` split into `sim/systems/*`. `step()` runs a fixed-order pipeline (decision log). `tests/sim/golden.test.ts` locks a 468-week seed-42 run.
- SM-016: Rental property. `buyProperty`, `sellProperty`, 3 Kingston types, 9% mortgages that amortize, 1.5% weekly vacancy for 6 weeks, 4% yearly appreciation, 1% maintenance, max 3 owned.
- SM-017: Business growth. 4 stages, `reinvestBusiness`, 1 failure draw per business per week, doubled under energy 20.
- SM-018: `content/events/stage1_shortcuts.json` holds 18 shortcut and delayed follow-up events. `content/tags.json` holds `shadyTags`. Total events: 59 across 8 files.
- SM-019: Balance strategies resolve every pending event by rule. 300 seeds per strategy. Report has $1M age, consequence rates and T1 to T4 lines.
- SM-020: Run ends at week 468. `stage1Complete`, `summary`, `choiceLog`, `maxWealthTier` added. `step()` throws `"Stage 1 is complete"` after that. `deserialize` fills defaults for saves made before SM-020.
- SM-023: Phone UI has Jobs, Bank, Housing and Business apps. `step()` calls sit in try/catch.
- SM-024: 3 shortcut events rebalanced. The loan shark event and `shady_loan_collector` are reachable.
- SM-025: Competent and greedy strategies reinvest in businesses and buy property with cash buffers (8 weeks and 2 weeks of costs). T3 counts major delayed consequences.
- TUNE-1: `cities.kingston.jobs[full_time].hourlyWageUsd` 7.00 to 6.00. All 4 balance targets pass (report.md, SM-025 run).
- `content/index.ts` is the single event list. `npm run validate` fails when a file in `content/events/` is missing from it.

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

- Nothing. SM-021 and SM-026 merged in f6346c7 (summary screen, Property app, Grow action, bank labels mortgages and excludes them from the loan cap). Verified in headless Chrome at 390 px.
- Next: Sprint D tickets SM-027 to SM-036 in `docs/BACKLOG.md` Ready.

## Balance status (report.md, SM-025 run with TUNE-1)

| ID | Target | Actual | Result |
|---|---|---|---|
| T1 | Competent median $1M at age 27 to 30 | 28.6; 254 of 300 runs reach $1M; W468 median $1,251,299 | PASS |
| T2 | Greedy median age at $1M below competent | 27.1 vs 28.6 | PASS |
| T3 | ≥ 50% of greedy runs fire a major delayed consequence | 100.0% | PASS |
| T4 | Passive W468 median under $50,000 | $44,190 | PASS |

## Vertical slice 17.1 checklist status

| # | Criterion | State | Evidence | Closes it |
|---|---|---|---|---|
| 1 | New run in Kingston at 21 with $2,000 | PASS | `newGame` defaults (SM-001). UI first load calls `newGame(Date.now() >>> 0, "kingston")` (SM-012) | — |
| 2 | The 100-hour split changes outcomes | PASS | W468 medians: greedy $1,885,767, competent $1,251,299, passive $44,190. Smallest pairwise gap $634,468 (rule: ≥ $50,000) | — |
| 3 | Events fire with costly choices | PASS | 18 shortcut events carry shady tags (SM-018). Rule needs 10 | — |
| 4 | ≥ 3 delayed consequences fire 1 to 5 years after trigger | PARTIAL | All 14 delayed ids fire in at least 1 run. `minYearsAfterTag` ≥ 1 sets the 52-week floor. The report does not show delay, so the 260-week ceiling is unverified | SM-035 |
| 5 | Take a loan, start a business, buy a property | PASS | Sim tests pass for all 3 (SM-005, SM-007, SM-016). UI has loans, business launch and growth (SM-023, SM-026) and the Property app (SM-026) | — |
| 6 | Close the browser and reload the save | PASS (implementation) | `serialize`/`deserialize` to localStorage (SM-012). Old saves get defaults (SM-020). No human reload check logged | Human playtest |
| 7 | Run ends at 30 with a summary screen | PASS | Sim ends at week 468 with a summary (SM-020). Summary screen with New run button (SM-021) | — |

## Open issues

- Growth saturates early. Competent reaches business stage 4 at median age 24.8. Greedy at 25.0. Both own 3 properties by W156. Ages 25 to 30 have no growth decision. SM-036.
- Passive W468 net worth has zero variance: p10 = median = p90 = $44,190. SM-034.
- Loan `principalUsd` never decreases during repayment. Net worth overstates debt until the loan ends. SM-033.
- The skilled job ($12.00) is open at week 0, against GDD 8.1. SM-031, then SM-032 and `/autotune`.
- Competent misses $1M in 46 of 300 runs. W156 p10 is $124,789 vs median $165,046. T1 still passes on the median.
- No bankruptcy floor. Random runs end at -$58,035 median net worth and get evicted in 99.7% of runs. Not ticketed. Stage 1 has no game-over by design (GDD 15).
- Two delayed events never fire for a scored strategy: `followup_partner_sues` and `followup_tobias_calls_ledger` (random only). Not a target miss.

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

## SM-014 changes

- `ui/main.ts`: Net worth chart and history log screens added.
  - `nwHistory: number[]` stored to localStorage (`self-made-nw`). One entry pushed after every `step()` call (before events resolve). Loaded on startup.
  - `renderChart()`: inline SVG line chart. Auto-scaling Y axis. Dashed tier lines at $10K (green) and $1M (yellow) when in range. X-axis ticks at start/mid/end. Short label formatter ($K/$M). Falls back to empty-state text before first week.
  - `renderHistoryLog()`: reverse-chronological list of `state.history`. Week label + action string + tag pills per entry. Scrollable.
  - Two nav icon buttons in the home header (▲ for chart, ☰ for history). Each has a back button to return home.
  - `showScreen` signature extended to include the two new screen ids.
- `ui/style.css`: Added `.btn-icon`, `.header-actions`, `.chart-*`, `.history-*`, `.tag-pill` styles. All match dark theme.
- `npm run build` clean. 169 tests green.

## SM-013 changes

- `ui/main.ts`: Event card screen added.
  - Imports all 7 event JSON files via Vite JSON import at module top level.
  - `loadEvents()`, `applyEvent()` imported directly from `sim/index.ts` (no shims needed — SM-008 exported them).
  - `step()` now called with `EVENTS` as third argument so `selectEvents()` runs inside `step()`.
  - `advanceWeek()` reads `pendingEvents` from `step()` return; if non-empty, routes to `screen-event` and renders first card.
  - `resolveEvent()` calls `applyEvent()`, pops queue, shows next card or returns home.
  - `screen-event` div added to DOM with channel chip, title, body, choices container.
- `ui/style.css`: `.event-card`, `.event-channel`, `.event-title`, `.event-body`, `.event-choices` added.

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
| 2026-11-09 | CONFLICT: GDD section 17 targets (passive $10K to $80K, competent $500K to $2M, greedy $800K to $3M at week 468, greedy "consequence tag" 50%) and the section 12 curve contradicted CONCEPT.md | CONCEPT.md is the source of truth. Human flagged it |
| 2026-11-09 | FIX: CONCEPT targets restored in GDD sections 12 and 17. Passive median W468 < $50K. Competent median W468 ≥ $1M or median age at first $1M in 27.0 to 30.0. Greedy median age at first $1M < competent, and ≥ 50% of greedy runs fire ≥ 1 delayed consequence event. Logged in GDD section 18 | Slice runs end at week 468, so the age 27 to 32 band is tested as 27 to 30 or a week-468 median ≥ $1M |
| 2026-11-09 | Greedy consequence metric is "delayed consequence event fired", not "consequence tag present" | CONCEPT requires the consequence to trigger, not just the tag to exist |
| 2026-11-09 | Balance suite moves from 100 to 300 seeds per strategy | Human direction; tighter medians for pass/fail |
| 2026-11-09 | Old SM-015 (pm-owned economy tuning across sim/ and content/) deleted | It broke folder ownership. Replaced by SM-015 to SM-022 with single owners |
| 2026-11-09 | Run always ends at week 468. Reaching $1M earlier sets `stage2_unlocked` and play continues | Stage 2 is out of slice scope; the age-30 summary is an exit criterion |
| 2026-11-09 | Property spec: 3 Kingston types ($30K, $65K, $150K), 20% min down, 3% closing, 9% APR, 520 or 1040 week terms, 1% maintenance, 1.5% weekly vacancy for 6 weeks, 4% yearly appreciation, 5% selling cost, max 3 owned | Net yield after costs about 8%, near break-even with a 9% mortgage. Leverage on appreciation drives the gain. `/autotune` adjusts |
| 2026-11-09 | Business growth: 4 stages, income ×1/×2/×4/×8, entry at 26/52/78 weeks plus $5K/$20K/$60K reinvestment, weekly failure 0.30%/0.15%/0.10%/0.05%, doubled under energy 20 | Gives competent play a path to $1M by age 30 through reinvestment. Book value stays at cost basis so growth cannot inflate net worth |
| 2026-11-09 | Shady tags live in `content/tags.json` (lore-writer) | Balance suite classifies choices without hardcoding story data in code |
| 2026-11-09 | CONCEPT lists 40 slice events; SM-018 brings the total to 51 to 53. 40 treated as a floor | Human directed SM-018 |
| 2026-11-09 | Sprint tracks: A = SM-015 alone; B = SM-016, SM-017, SM-018, SM-019, SM-022 in parallel; C = SM-020, SM-021, then `/autotune` | SM-015 touches every sim file and would conflict with parallel sim work |
| 2026-11-09 | `step()` pipeline order: skills, income, businessIncome, property, housingCost, loanRepayment, cashflow, eviction, jobLoss, energy, time, tiers, then events and endOfRun | SM-015 kept the pre-refactor order so the golden test passed unchanged. New systems slot into this list and STATE.md records each change |
| 2026-11-09 | RNG draws happen only when a business or property exists: 1 failure draw per business, 1 vacancy draw per occupied property | Runs without assets keep their pre-SM-016 RNG stream, so the golden run and older tests stay valid. SM-034 ends this rule with 1 draw every week |
| 2026-11-09 | Mortgages do not count toward `loans.maxSimultaneous` | Property secures the mortgage. Counting it would block a tier 1 owner from both loans |
| 2026-11-09 | Business growth timing: income pays at the start-of-week rate; the failure draw uses the start-of-week stage; survivors gain 1 week at stage, then advance at most 1 stage when both thresholds are met | A business that grows or fails still pays that week, and growth lands on the step where `weeksAtStage` reaches the minimum, never before |
| 2026-11-09 | Golden re-records: SM-017 (business failure draws), SM-020 (hash only, new state fields; numeric values unchanged), TUNE-1 (full-time wage changes cash) | SM-015 rule: every behavior change re-records golden values and logs why |
| 2026-11-09 | T3 counts major delayed consequences only. Major = every choice has `cashUsd <= -250` or `reputation <= -10`. GDD section 12 and 17.2 updated | CONCEPT requires "at least 1 major delayed consequence". The "any" rate stays in the report for reference |
| 2026-11-09 | `content/index.ts` is the single event list. UI, balance suite and tests import it. `npm run validate` fails when a file in `content/events/` is missing from it | One list means a new event file reaches the UI, the balance suite and the tests together. Validate catches a file left out |
| 2026-11-09 | SM-018 shipped 18 events in one file, `stage1_shortcuts.json`, not two files. Total events 59, above the 51 to 53 in the ticket | Accepted. 40 is a floor (earlier row). Ticket wording was a file-layout detail, not a pillar |
| 2026-11-09 | New LORE names from SM-018 and SM-024: Bigga, loan shark on Waltham Park Road; Mr. Lyn, Princess Street wholesaler; Detective Sergeant Morrison at Half Way Tree; a Duke Street law office; a downtown registry clerk; Tobias Wren's valuer; Maxfield Recovery Services, which buys Bigga's debts; trust key `tobias_wren` | Introduced in content by lore-writer, who owns LORE.md. Later content must reuse these names, not invent new ones for the same roles |
| 2026-11-09 | SM-022 (terminal play mode) cancelled by the human. Moved to Icebox. GDD 17.1 item 5 is verified in the phone UI | Human direction: focus is the phone UI |
| 2026-11-09 | SM-026 created for the in-progress Property app and Grow action | Work started without a ticket. Commits need an id |
| 2026-11-09 | Passive variance comes from a weekly expense shock: 2% chance, $100 to $600 (GDD 7.2.1) | Expected cost $3,276 over 468 weeks keeps passive near $40,900, under the $50K cap. A wage raise would push passive past the cap |
| 2026-11-09 | The skilled job gate (financial 3, GDD 8.1) is enforced in `holdJob` by SM-031. SM-032 updates the competent strategy | The GDD already required it. `holdJob` checks only that the job id exists |
| 2026-11-09 | Loan liabilities get required `kind` and `aprPct` (SM-027) before amortization (SM-033) and unique ids (SM-029). The three run in sequence | All three edit `sim/systems/loans.ts`. Amortization needs the stored APR |
| 2026-11-09 | Late-slice depth is a pm design ticket (SM-036), not a config change | balance-qa found no config fix. New decisions must stay in Stage 1 scope: one person, no employees, Kingston only |
