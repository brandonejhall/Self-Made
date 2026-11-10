# Self Made

A life-to-empire simulation. The player starts at 21 with $2,000 in one of 6 cities and builds toward a world-scale dynasty from 2026 to 2086.

## Canon sources (read in this order)

1. `docs/STATE.md`: what exists, what is in progress, decision log. Read before any work.
2. `docs/CONCEPT.md`: the game concept. Source of truth for scope and pillars.
3. `docs/LORE.md`: the lore bible. Canon. Never contradict it.
4. `docs/GDD.md`: the design spec the pm agent maintains.
5. `docs/BACKLOG.md`: tickets.

## Rules for every session

- Work one ticket per session. Put the ticket ID in the commit message: `SM-012: add rent and eviction`.
- Stay inside your owned folders (see `.claude/agents/`). Need a change elsewhere? Add a ticket to `docs/BACKLOG.md` under "Requested" and stop.
- `/sim` never imports from `/ui`. `/sim` never touches the DOM, `window`, `localStorage` or `Date.now()`.
- Every system is a pure function: `(state, input, rng) -> newState`. All randomness flows from the seeded RNG in `sim/rng.ts`.
- All tunable numbers live in `sim/config.ts`. No magic numbers anywhere else.
- Game content (events, characters, cities, sectors) lives in `/content` as JSON validated against `/content/schema`. Code never hardcodes story text.
- A ticket is done only when its acceptance criteria pass as tests and `npm test` is green.
- Update `docs/STATE.md` at the end of every ticket: what changed, what you decided, why.

## Commands

- `npm test` runs all unit tests.
- `npm run balance` runs the headless balance suite and writes `tests/balance/report.md`.
- `npm run dev` starts the UI.
- `npm run build` builds the static site to `dist/` for Cloudflare Pages.

## Agents

| Agent | Owns |
|---|---|
| pm | `docs/` except `LORE.md` |
| sim-engineer | `sim/`, `tests/sim/` |
| ui-engineer | `ui/` |
| lore-writer | `content/`, `docs/LORE.md` |
| balance-qa | `tests/balance/` |

The main session orchestrates: it reads the backlog, sends each ticket to the owning agent, and runs independent tickets in parallel git worktrees.
