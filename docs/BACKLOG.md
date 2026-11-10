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

### SM-015: Economy tuning — business growth events, property rental mechanics
- Owner: pm
- Goal: Close the gap between current balance suite results ($356K competent, $414K greedy at W468) and GDD targets ($500K–$2M, $800K–$3M)
- Files: `docs/GDD.md`, `docs/BACKLOG.md`, `sim/config.ts`, `content/events/`
- Depends on: SM-014
- Size: M
- Acceptance:
  - [ ] Business weekly income increases over time via growth events (food stall → delivery → content brand → short-term rental progression)
  - [ ] Property rental mechanics added (player can buy and rent out units as an asset class)
  - [ ] At least 50% of greedy runs produce a consequence tag at week 468 (`npm run balance` passes consequence check)
  - [ ] Competent W468 median ≥ $500,000 in balance suite
  - [ ] Greedy W468 median ≥ $800,000 in balance suite

## Icebox
