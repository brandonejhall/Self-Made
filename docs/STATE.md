# State

Every agent reads this first and updates it last.

## Built

- Repo scaffold: TypeScript, Vite, Vitest.
- `sim/` skeleton: types, seeded RNG, config, a `step()` that advances one week.
- One passing smoke test.

## In progress

- Nothing. Next step: pm writes `docs/GDD.md` and the Stage 1 vertical slice tickets.

## Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-11-09 | Sim is pure TypeScript with a seeded RNG | Headless balance runs must reproduce exactly |
| 2026-11-09 | Content is JSON in `/content` | Lore-writer works without touching code |
| 2026-11-09 | Vertical slice is Kingston, Stage 1 only | Prove the core loop before building scale |
