# State

Every agent reads this first and updates it last.

## Built

- Repo scaffold: TypeScript, Vite, Vitest.
- `sim/` skeleton: types, seeded RNG, config, a `step()` that advances one week.
- One passing smoke test.
- SM-001: `Asset` and `Liability` interfaces added to `sim/types.ts`. `GameState` extended with 11 new fields: `skills`, `trust`, `assets`, `liabilities`, `firedEvents`, `housingTier`, `overdueWeeks`, `burnoutWeeks`, `wealthTier`, `activeJobId`, `underHoursWeeks`. `newGame()` initializes all to zero values. `netWorthUsd()` now sums cash + asset book values minus liability principals. Round-trip serialize test added for all new fields.

## In progress

- Nothing.

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
