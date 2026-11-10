# State

Every agent reads this first and updates it last.

## Built

- Repo scaffold: TypeScript, Vite, Vitest.
- `sim/` skeleton: types, seeded RNG, config, a `step()` that advances one week.
- One passing smoke test.
- SM-001: `Asset` and `Liability` interfaces added to `sim/types.ts`. `GameState` extended with 11 new fields: `skills`, `trust`, `assets`, `liabilities`, `firedEvents`, `housingTier`, `overdueWeeks`, `burnoutWeeks`, `wealthTier`, `activeJobId`, `underHoursWeeks`. `newGame()` initializes all to zero values. `netWorthUsd()` now sums cash + asset book values minus liability principals. Round-trip serialize test added for all new fields.

## In progress

- Nothing.

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
