# Self Made

Start at 21 with $2,000 and a rented room. Build a life into a world-scale dynasty from 2026 to 2086.

Built by Claude agents. See `CLAUDE.md` for the rules every agent follows.

## Setup

```
npm install
npm test
npm run dev
```

## Agent workflow (Claude Code)

1. `/kickoff`: the pm writes the GDD and the vertical slice tickets.
2. `/sprint`: Ready tickets go to their owning agents, in parallel where possible.
3. Play the build with `npm run dev`.
4. `/playtest <your notes>`: the pm turns your notes into tickets.
5. Repeat 2 to 4.

## Layout

| Path | Owner | Contents |
| --- | --- | --- |
| `docs/` | pm, lore-writer | Concept, lore, GDD, backlog, state |
| `sim/` | sim-engineer | Pure TypeScript simulation |
| `content/` | lore-writer | Events and data as JSON |
| `ui/` | ui-engineer | Interface |
| `tests/balance/` | balance-qa | Headless balance runs |

## Deploy

Cloudflare Pages: build command `npm run build`, output directory `dist`.
