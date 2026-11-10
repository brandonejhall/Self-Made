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

## SM-013: Wire event cards to UI

**Owner:** ui-engineer
**Depends on:** SM-012
**Status:** Ready

### What
When `step()` returns pending events, the UI must display them as full-screen event cards before returning to the home screen. Each card shows the event channel icon, title, body text, and 2–4 choice buttons. After the player chooses, `applyEvent()` is called, state is updated and saved, and the next event card is shown (if more than one event fired this week). After all events are resolved the player returns to the home screen showing the final post-event state.

### Acceptance criteria
- [ ] After calling `step()`, if any events are returned they are displayed as cards before showing the home screen
- [ ] Each event card shows: a channel label (text / news / call / document / email / briefing), the event title, the event body, and one button per choice
- [ ] Selecting a choice calls `applyEvent(state, eventId, choiceIndex, events)` and saves the resulting state to localStorage
- [ ] If two events fire in one week, the second card is shown after the first choice is confirmed
- [ ] The player cannot skip an event (the Advance Week button is hidden while events are pending)
- [ ] On the `grandmother_shoebox` event, the channel label displays "document"
- [ ] All event text is sourced from the event JSON loaded at startup; no event text is hardcoded in the UI

---

## SM-014: Net worth tracker and history log screens

**Owner:** ui-engineer
**Depends on:** SM-013
**Status:** Ready

### What
Two secondary screens complete the vertical slice UI. The Net Worth Tracker shows a line chart of `netWorthUsd()` over all weeks played, with wealth tier thresholds ($10,000 and $1,000,000) marked as horizontal rules. The History Log shows all `HistoryEntry` items in reverse chronological order, with each entry showing its week, action string, and tag pills. These screens do not advance game state; they are read-only views.

### Acceptance criteria
- [ ] Net worth tracker renders a line chart with one data point per week played, x-axis in weeks, y-axis in USD
- [ ] Horizontal lines on the chart mark $10,000 (Tier 1 threshold) and $1,000,000 (Tier 2 / Stage 2 threshold) in a visually distinct color
- [ ] The chart updates after each week advance
- [ ] History log shows all `state.history` entries newest first, each with week number, action label, and tag chips
- [ ] History log is scrollable and renders correctly at 390px viewport width
- [ ] Both screens are reachable from the home screen via navigation and return to the home screen on back
- [ ] `npm run build` produces a deployable `dist/` with no build errors

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
