# Backlog

The pm agent owns this file. Other agents add items only under "Requested".

## Tracks

| Sprint | Tickets | Run mode |
|---|---|---|
| A | SM-015 | Done |
| B | SM-016, SM-017, SM-018, SM-019 | Done. SM-022 cancelled |
| C | SM-020, SM-023, SM-024, SM-025, TUNE-1 | Done |
| C2 | SM-021, SM-026 | Done (f6346c7) |
| D1 | SM-027, then SM-029, then SM-033 | Sequential. All three edit `sim/systems/loans.ts` and `sim/types.ts` |
| D2 | SM-030, SM-031, SM-034, SM-035, SM-036 | Parallel with D1. SM-030 and SM-031 both touch `CONFIG.cities.kingston.jobs`: run SM-030 first |
| D3 | SM-028 after SM-027; SM-032 after SM-031; `/autotune` after SM-031, SM-033 and SM-034 | Follow-ups |

Spec references: GDD sections 7.2 (expenses, expense shock), 7.4 (loans), 8.1 (jobs), 8.4 (business growth), 9.1 (property), 11 (shady tags, delayed consequences), 12 (balance targets), 15.1 (summary), 17 (exit criteria).

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

### SM-027: Store APR on every loan liability
- Owner: sim-engineer
- Goal: Every loan `Liability` carries its APR so the UI and the amortization in SM-033 read it from state.
- Files: `sim/systems/loans.ts`, `sim/systems/housing.ts` (eviction repay), `sim/index.ts` (deserialize), `sim/types.ts`, `tests/sim/loans.test.ts`, `tests/sim/golden.test.ts`
- Depends on: none
- Size: S
- Acceptance:
  - [ ] `Liability.kind` and `Liability.aprPct` are required fields in `sim/types.ts`.
  - [ ] `takeLoan` sets `kind: "loan"` and `aprPct` equal to `effectiveLoanApr(state)` at the time of the loan. A player with negotiation 8 gets `aprPct: 16`. A player with negotiation 100 gets `aprPct: 4`.
  - [ ] Raising negotiation after a loan is taken does not change that loan's `aprPct`.
  - [ ] The eviction repayment liability has `kind: "loan"` and `aprPct: 0`.
  - [ ] `buyProperty` mortgages have `kind: "mortgage"` and `aprPct: 9` (`CONFIG.property.mortgageAprPct`).
  - [ ] `deserialize` of a save whose liabilities lack `kind` or `aprPct` fills: `kind: "mortgage"` when `propertyId` is set, else `kind: "loan"`; mortgage `aprPct` = `CONFIG.property.mortgageAprPct`; ids starting `eviction_repay_` get 0; other loans get `CONFIG.loans.baseAprPct`.
  - [ ] Weekly payments for new loans are unchanged from the current formula.
  - [ ] Golden test values re-recorded only if the golden run changes; STATE.md notes the reason.

### SM-028: UI reads loan APR from state
- Owner: ui-engineer
- Goal: The Bank app shows each loan's APR from `Liability.aprPct` and stops storing APR in `localStorage`.
- Files: `ui/main.ts`
- Depends on: SM-027
- Size: S
- Acceptance:
  - [ ] No `localStorage` key holds loan APR. On load the UI deletes any legacy APR key it wrote before.
  - [ ] The Bank app shows `aprPct` for every active loan, read from `state.liabilities`.
  - [ ] A save made before SM-027 loads and shows the APR filled by `deserialize`.
  - [ ] `npm run build` is clean.

### SM-029: Unique liability ids
- Owner: sim-engineer
- Goal: Two loans of the same amount in the same week get distinct ids.
- Files: `sim/systems/loans.ts`, `sim/systems/housing.ts`, `sim/systems/property.ts`, `sim/index.ts`, `sim/types.ts`, `tests/sim/loans.test.ts`, `tests/sim/golden.test.ts`
- Depends on: SM-027
- Size: S
- Acceptance:
  - [ ] `GameState.nextLiabilitySeq: number` exists, 0 in `newGame`.
  - [ ] `takeLoan` assigns id `loan_<nextLiabilitySeq>` and increments the counter by 1. Mortgages use `mortgage_<n>` and eviction repayments use `eviction_repay_<n>` from the same counter.
  - [ ] A tier 1 player who takes two $1,000 loans in week 10 holds 2 liabilities with different ids.
  - [ ] `deserialize` of a save without `nextLiabilitySeq` sets it to the save's `liabilities.length`. Old ids keep their old strings.
  - [ ] Ids are deterministic: the same seed and inputs produce the same ids.
  - [ ] Golden test values re-recorded only if the golden run changes; STATE.md notes the reason.

### SM-030: Move the full-time hustle cap to config
- Owner: sim-engineer
- Goal: Remove the literal 20 from `sim/systems/input.ts` and drive the cap from each job's config entry.
- Files: `sim/config.ts`, `sim/systems/input.ts`, `tests/sim/jobs.test.ts`, `tests/sim/config.test.ts`
- Depends on: none
- Size: S
- Acceptance:
  - [ ] Each entry in `CONFIG.cities.kingston.jobs` has `maxHustleHours: number | null`. Values: gig `null`, part_time `null`, full_time `20`, skilled `20`.
  - [ ] `sim/systems/input.ts` contains no numeric literal for the cap and no `minCommitHours >= 40` check.
  - [ ] With full_time or skilled held, hustle 21 is rejected and hustle 20 is accepted. The error string reads `Job limits hustle to <maxHustleHours> hours per week`.
  - [ ] With gig, part_time or no job, hustle 60 is accepted.
  - [ ] The golden test passes unchanged.

### SM-031: Job skill requirements
- Owner: sim-engineer
- Goal: The skilled job requires financial skill 3 per GDD section 8.1, so it is not open at week 0.
- Files: `sim/config.ts`, `sim/systems/jobs.ts`, `tests/sim/jobs.test.ts`
- Depends on: SM-030
- Size: S
- Acceptance:
  - [ ] Each job entry has `requiresSkills: Record<string, number>`. Values: gig, part_time, full_time `{}`; skilled `{ financial: 3 }`.
  - [ ] `holdJob(newGame(1, "kingston"), "skilled")` returns the unchanged state and the error `Skilled job requires financial skill 3`.
  - [ ] `holdJob` with `skills.financial = 3` on "skilled" succeeds and sets `activeJobId = "skilled"`.
  - [ ] `holdJob` on gig, part_time and full_time succeeds at week 0.
  - [ ] Dropping below the requirement after taking the job does not remove the job. Skills never decrease in Stage 1.
  - [ ] Existing job tests that hold "skilled" at week 0 are updated to set financial 3 first.
  - [ ] The golden test passes unchanged (it holds full_time).

### SM-032: Competent strategy respects the skilled job gate
- Owner: balance-qa
- Goal: The competent strategy earns financial 3 before it takes the skilled job, and the report shows the effect.
- Files: `tests/balance/strategies.ts`, `tests/balance/strategies.test.ts`, `tests/balance/report.md`, `tests/balance/recommendations.md`
- Depends on: SM-031
- Size: S
- Acceptance:
  - [ ] Competent holds full_time from week 0 and calls `holdJob("skilled")` on the first week `skills.financial >= 3`.
  - [ ] No strategy ignores a `holdJob` error. A strategy test asserts every `holdJob` call it makes returns `null` error.
  - [ ] `report.md` is regenerated. If T1 to T4 fail, `recommendations.md` lists config changes verified with what-if mode.

### SM-033: Loan principal amortizes
- Owner: sim-engineer
- Goal: Loan `principalUsd` shrinks each week so net worth stops overstating debt.
- Files: `sim/systems/loans.ts`, `tests/sim/loans.test.ts`, `tests/sim/golden.test.ts`
- Depends on: SM-027
- Size: S
- Acceptance:
  - [ ] Each step, every `kind: "loan"` liability reduces `principalUsd` by `weeklyPaymentUsd − round2(principalUsd × aprPct / 100 / 52)`, rounded to cents. Mortgages keep their SM-016 rule.
  - [ ] A $1,000 loan at 18% over 26 weeks has `principalUsd` below $1,000 after 1 step and is removed after step 26.
  - [ ] On the final payment week the payment equals remaining principal plus that week's interest, so total paid never leaves a residual over $0.01 and principal never goes negative.
  - [ ] An `aprPct: 0` eviction repayment drops by exactly $20 per step.
  - [ ] `netWorthUsd` falls by less than the weekly payment on a week with no other changes.
  - [ ] Golden test values re-recorded only if the golden run changes; STATE.md notes the reason.

### SM-034: Weekly expense shock
- Owner: sim-engineer
- Goal: Add the GDD section 7.2.1 expense shock so wage-only runs vary across seeds.
- Files: `sim/config.ts`, `sim/systems/expenseShock.ts`, `sim/index.ts`, `tests/sim/expenseShock.test.ts`, `tests/sim/golden.test.ts`
- Depends on: none
- Size: S
- Acceptance:
  - [ ] `CONFIG.expenses` holds `shockChancePerWeek: 0.02`, `shockMinUsd: 100`, `shockMaxUsd: 600`.
  - [ ] The shock system runs in the pipeline after `housingCost` and before `loanRepayment`. STATE.md records the new order.
  - [ ] Every step draws exactly 1 `nextRandom` for the chance. When the draw is below 0.02 it draws 1 more for the amount: `round2(100 + u × 500)`.
  - [ ] With a crafted `rngState` that forces a hit, cash drops by the shock amount and history gets `{ action: "unplanned_expense_<amount>", tags: ["unplanned_expense"] }`.
  - [ ] With a forced miss, cash and history match a run without the system.
  - [ ] Golden test re-recorded. STATE.md logs the reason: the new per-week draw shifts every RNG stream.
  - [ ] Over seeds 0 to 299 with the passive strategy, W468 net worth p10 and p90 differ by at least $1,000 (checked by balance-qa in the next report).

### SM-035: Report delay per delayed consequence
- Owner: balance-qa
- Goal: Restore the delay column so GDD 17.1 item 4 is verifiable.
- Files: `tests/balance/run.ts`, `tests/balance/report.md`
- Depends on: none
- Size: S
- Acceptance:
  - [ ] The delayed consequence table adds, per event id, the median, min and max delay in weeks from the week its `requiresTags` tag first appeared to the week it fired, across all 1,200 runs.
  - [ ] The report adds a line: count of distinct delayed consequence ids with at least 1 fire whose delay is 52 to 260 weeks, and PASS when the count is at least 3.

### SM-036: Late-slice depth design (ages 25 to 30)
- Owner: pm
- Goal: Spec Stage 1 decisions for players who have hit business stage 4 and the 3-property cap, so ages 25 to 30 are not a dead state.
- Files: `docs/GDD.md`, `docs/BACKLOG.md`, `docs/STATE.md`
- Depends on: none
- Size: M
- Evidence: SM-025 report. Competent reaches business stage 4 at median age 24.8. Greedy at 25.0. Both hold 3 properties by W156 (age 24).
- Acceptance:
  - [ ] GDD gets a section 8.5 with at least 2 new late-slice decisions. Each one states its unlock condition, cost, payoff, risk and config keys in numbers.
  - [ ] Each decision serves a named pillar from CONCEPT.md and stays inside Stage 1 scope (one person, no employees, no corporate entities, Kingston only).
  - [ ] Each decision names a LORE.md source or is flagged for lore-writer before any content ticket.
  - [ ] GDD section 12 adds a guide rail: competent and greedy median age at last growth decision (reinvest, buy, launch or a new section 8.5 action) ≥ 28.0.
  - [ ] T1 to T4 targets are unchanged.
  - [ ] Implementation is split into S or M tickets for sim-engineer, ui-engineer, lore-writer and balance-qa, each with acceptance criteria.

---

## In progress

### SM-021: Age-30 summary screen
- Owner: ui-engineer
- Goal: Show the SM-020 summary when the run ends and let the player start a new run.
- Files: `ui/main.ts`, `ui/style.css`
- Depends on: SM-020 (done)
- Size: S
- Acceptance:
  - [ ] When `state.stage1Complete` is true after a step or on load, the UI routes to `screen-summary` and hides the Advance Week control.
  - [ ] The screen shows final net worth, tier reached, up to 5 top choices (week, event title, net worth delta) and the list of consequence event titles fired.
  - [ ] Event titles come from the loaded event JSON by id, not hardcoded.
  - [ ] A New run button clears the `localStorage` save and net worth history, calls `newGame(Date.now() >>> 0, "kingston")` and routes to Home at week 0 with $2,000.
  - [ ] Reloading the browser on a completed run shows the summary screen again.
  - [ ] `npm run build` is clean. Layout fits a 390px wide viewport with no horizontal scroll.

### SM-026: Property app and business Grow action
- Owner: ui-engineer
- Goal: Expose `buyProperty`, `sellProperty` and `reinvestBusiness` in the phone UI so GDD 17.1 item 5 passes in the browser.
- Files: `ui/main.ts`, `ui/style.css`
- Depends on: SM-016, SM-017, SM-023 (all done)
- Size: M
- Acceptance:
  - [ ] A Property app lists the 3 `CONFIG.property.types` with price, weekly rent, minimum down payment and closing cost read from `CONFIG`.
  - [ ] The player picks a down payment and a 520 or 1040 week term. Buy calls `buyProperty`. A sim error string shows unchanged and the state does not change.
  - [ ] Owned properties show occupied or vacant, book value, mortgage principal and weekly payment. Sell calls `sellProperty`.
  - [ ] The Business app shows each business's stage name, weeks at stage, reinvested amount and the next stage's week and cash requirement. Grow calls `reinvestBusiness` with a player-entered amount.
  - [ ] Every action call sits inside the same try/catch guard as `step()`.
  - [ ] `npm run build` is clean. Layout fits a 390px wide viewport with no horizontal scroll.

---

## Done

### SM-001 through SM-014 (completed 2026-11-09)

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

### SM-015 through TUNE-1 (completed 2026-11-09)

| Ticket | Title | Owner | Summary |
|---|---|---|---|
| SM-015 | Split sim/index.ts into system modules | sim-engineer | `step()` is a fixed-order pipeline over `sim/systems/*`; golden 468-week test passes unchanged. |
| SM-016 | Rental property system | sim-engineer | `buyProperty`/`sellProperty`, 3 Kingston types, mortgages, vacancy, appreciation, maintenance. |
| SM-017 | Business growth stages | sim-engineer | 4 stages, `reinvestBusiness`, weekly failure draw per business. |
| SM-018 | Shortcut events and delayed follow-ups | lore-writer | 18 shortcut and follow-up events in `content/events/stage1_shortcuts.json`; total 59 events. |
| SM-019 | Balance strategies resolve event choices | balance-qa | Per-strategy choice rules, 300 seeds, $1M age, consequence rates, T1 to T4 pass/fail lines. |
| SM-020 | End the run at week 468 with a summary | sim-engineer | `stage1Complete`, `summary`, `choiceLog`, `maxWealthTier`; `deserialize` fills defaults for old saves. |
| SM-023 | Jobs, Bank, Housing and Business apps in the phone UI | ui-engineer | Loan, job, housing and launch actions in the browser; `step()` wrapped in try/catch. |
| SM-024 | Rebalance shortcut events | lore-writer | Rebalanced 3 shortcut events; the loan shark event and `shady_loan_collector` are now reachable. |
| SM-025 | Strategies use property and growth | balance-qa | Competent and greedy reinvest and buy property with cash buffers; T3 counts major consequences. |
| TUNE-1 | Full-time wage 7.00 to 6.00 | sim-engineer | All 4 balance targets pass: competent $1M at 28.6, greedy 27.1, greedy major consequence 100%, passive W468 $44,190. |

---

## Requested

## Icebox

### SM-022: Playable CLI with events and actions
- Status: Cancelled 2026-11-09 by the human.
- Reason: Focus is the phone UI. GDD 17.1 item 5 is verified in the UI (SM-023, SM-026) instead of `npm run play`.
- Original owner: sim-engineer. Original scope: `cli/play.ts`, `cli/commands.ts`, `tests/sim/cli.test.ts`.
