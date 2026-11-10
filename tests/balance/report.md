# Balance Report (SM-019)

Seeds 0 to 299 per strategy (300 runs each), city kingston, 468 weeks. Reproduce one run with `newGame(seed, "kingston")` and the strategy in `tests/balance/run.ts`.
Events loaded: 58 from 8 files. Delayed-consequence events (requiresTags + minYearsAfterTag): `shady_loan_collector`, `ex_partner_competitor`, `eviction_insurance_block`, `sibling_second_ask`, `loan_refinance_offer`, `followup_loan_shark_collects`, `followup_partner_sues`, `followup_permit_raid`, `followup_tax_audit`, `followup_stolen_phones_traced`, `followup_bribe_clerk_arrested`, `followup_forged_valuation_exposed`, `followup_sibling_injury`, `followup_tobias_calls_ledger`.
Runtime: 5.6 s for 1200 runs.

Age at week w = 21 + w/52. W156 = age 24, W312 = age 27, W468 = age 30.

## Event choice rules

Strategies resolve each pending event through `applyEvent(state, eventId, choiceIndex, EVENTS)`. Remaining ties go to the lowest choice index.

- greedy: highest `cashUsd`; ties go to the choice that adds more tags.
- competent: excludes choices that add a tag in another event's `trigger.requiresTags`; among the rest, highest `cashUsd + reputation`.
- passive: smallest sum of |cashUsd| + |energy| + |reputation| + |trust deltas|; ties go to fewer tags.
- random: uniform choice index from a local RNG seeded with the run seed. Baseline only, not scored.

Gating tags the competent rule avoids: `bought_stolen_stock`, `cut_out_partner`, `cut_partner_first`, `evicted`, `forged_valuation`, `has_shoebox`, `ignored_sibling_ask`, `learned_market_finance`, `met_first_partner`, `met_halima`, `owes_tobias_wren`, `paid_bribe`, `paid_sibling_off_books`, `skipped_permit`, `took_dataproc_job`, `took_loan`, `took_loan_shark`, `took_shady_loan`, `underreported_income`.

## Net worth

| Strategy | W156 p10 | W156 median | W156 p90 | W312 p10 | W312 median | W312 p90 | W468 p10 | W468 median | W468 p90 |
|---|---|---|---|---|---|---|---|---|---|
| greedy | $101,352 | $109,585 | $111,439 | $265,722 | $273,810 | $276,030 | $431,494 | $439,266 | $441,910 |
| competent | $93,381 | $95,002 | $97,072 | $209,283 | $211,949 | $214,469 | $326,868 | $329,771 | $332,716 |
| passive | $22,275 | $22,275 | $22,275 | $41,755 | $41,755 | $41,755 | $62,035 | $62,035 | $62,035 |
| random | $-18,713 | $-13,720 | $-9,137 | $-40,671 | $-35,922 | $-30,053 | $-62,512 | $-57,522 | $-51,022 |

## $1M, evictions, delayed consequences

| Strategy | Median age at $1M | Runs reaching $1M | Eviction rate | Runs with >=1 delayed consequence | Runs with >=1 major delayed consequence |
|---|---|---|---|---|---|
| greedy | not reached | 0 / 300 (0.0%) | 0.0% | 300 / 300 (100.0%) | 300 / 300 (100.0%) |
| competent | not reached | 0 / 300 (0.0%) | 0.0% | 300 / 300 (100.0%) | 0 / 300 (0.0%) |
| passive | not reached | 0 / 300 (0.0%) | 0.0% | 300 / 300 (100.0%) | 300 / 300 (100.0%) |
| random | not reached | 0 / 300 (0.0%) | 99.7% | 300 / 300 (100.0%) | 248 / 300 (82.7%) |

Major = every choice costs at least $250 cash or 10 reputation. Major events: `followup_loan_shark_collects`, `followup_partner_sues`, `followup_permit_raid`, `followup_tax_audit`, `followup_stolen_phones_traced`, `followup_bribe_clerk_arrested`, `followup_forged_valuation_exposed`, `followup_sibling_injury`.

Delayed consequences fired, by event (total fires across runs):

| Event | greedy | competent | passive | random |
|---|---|---|---|---|
| `shady_loan_collector` (took_shady_loan) | 0 | 0 | 0 | 60 |
| `ex_partner_competitor` (cut_partner_first) | 300 | 0 | 0 | 85 |
| `eviction_insurance_block` (evicted) | 0 | 0 | 0 | 299 |
| `sibling_second_ask` (ignored_sibling_ask) | 300 | 0 | 300 | 105 |
| `loan_refinance_offer` (took_loan) | 300 | 300 | 0 | 235 |
| `followup_loan_shark_collects` (major) (took_loan_shark) | 0 | 0 | 0 | 145 |
| `followup_partner_sues` (major) (cut_out_partner) | 0 | 0 | 0 | 47 |
| `followup_permit_raid` (major) (skipped_permit) | 300 | 0 | 300 | 109 |
| `followup_tax_audit` (major) (underreported_income) | 300 | 0 | 300 | 131 |
| `followup_stolen_phones_traced` (major) (bought_stolen_stock) | 300 | 0 | 0 | 126 |
| `followup_bribe_clerk_arrested` (major) (paid_bribe) | 300 | 0 | 300 | 110 |
| `followup_forged_valuation_exposed` (major) (forged_valuation) | 300 | 0 | 0 | 4 |
| `followup_sibling_injury` (major) (paid_sibling_off_books) | 300 | 0 | 300 | 108 |
| `followup_tobias_calls_ledger` (owes_tobias_wren) | 0 | 0 | 0 | 106 |

## Top 5 most-picked choices

Ties sort by event id. Every `once` event fires in nearly every 468-week run, so counts of 300 are common.

**greedy**

- `aunt_pressure_home` #0 (Move back. Save cash, lose the workspace.): 300 picks
- `bad_debt_helping` #2 (Get someone from the community to pressure him.): 300 picks
- `community_dispute` #0 (Side with Miss Brown. Talk to Marcus.): 300 picks
- `energy_transition_construction` #0 (Apply to a solar installation crew.): 300 picks
- `era1_gig_shock` #0 (Register on the top gig apps now.): 300 picks

**competent**

- `aunt_pressure_home` #0 (Move back. Save cash, lose the workspace.): 300 picks
- `bad_debt_helping` #2 (Get someone from the community to pressure him.): 300 picks
- `community_dispute` #0 (Side with Miss Brown. Talk to Marcus.): 300 picks
- `energy_transition_construction` #0 (Apply to a solar installation crew.): 300 picks
- `era1_gig_shock` #0 (Register on the top gig apps now.): 300 picks

**passive**

- `aunt_pressure_home` #2 (Tell her you'll think about it.): 300 picks
- `bad_debt_helping` #2 (Get someone from the community to pressure him.): 300 picks
- `community_dispute` #2 (Stay completely out of it.): 300 picks
- `energy_transition_construction` #2 (Watch how the first contracts play out.): 300 picks
- `era1_gig_shock` #1 (Watch and wait. See which platform wins.): 300 picks

**random**

- `meet_halima` #0 (Go meet her at the shop.): 163 picks
- `first_partner_meet` #1 (Leave it. Too busy right now.): 158 picks
- `mobile_money_hustle` #1 (Not worth your time.): 157 picks
- `failed_hustle_food` #0 (Take the loss. Try again next weekend.): 155 picks
- `halima_loan_offer` #1 (Thank her and decline for now.): 154 picks

## Dominant choices (picked in over 80% of winning runs)

Greedy, competent and passive pick deterministically, so for them any event that fires in over 80% of winning runs shows up here. The list flags choices the rule always lands on, not player preference.

**greedy**: winning = no run reached $1M; top quartile by W468 net worth (>= $441,269); 75 runs.

`aunt_pressure_home#0` 100.0%, `bad_debt_helping#2` 100.0%, `community_dispute#0` 100.0%, `energy_transition_construction#0` 100.0%, `era1_gig_shock#0` 100.0%, `ex_partner_competitor#0` 100.0%, `failed_hustle_food#1` 100.0%, `family_emergency_cost#2` 100.0%, `family_funeral_contribution#2` 100.0%, `first_partner_meet#0` 100.0%, `followup_bribe_clerk_arrested#0` 100.0%, `followup_forged_valuation_exposed#1` 100.0%, `followup_permit_raid#1` 100.0%, `followup_sibling_injury#2` 100.0%, `followup_stolen_phones_traced#2` 100.0%, `followup_tax_audit#2` 100.0%, `gig_opportunity_delivery#0` 100.0%, `grandmother_land_dispute#1` 100.0%, `grandmother_shoebox#0` 100.0%, `halima_hustle_tip#0` 100.0%, `housing_repair#2` 100.0%, `job_offer_data_entry#0` 100.0%, `kingston_informal_market_event#1` 100.0%, `loan_refinance_offer#1` 100.0%, `market_theft#0` 100.0%, `meet_halima#0` 100.0%, `mid_decade_market_shift#0` 100.0%, `mobile_money_hustle#0` 100.0%, `neighbourhood_paint_contract#1` 100.0%, `partner_direction_conflict#2` 100.0%, `partner_financial_ask#1` 100.0%, `phone_scam#0` 100.0%, `shortcut_bribe_queue#0` 100.0%, `shortcut_cash_no_receipt#0` 100.0%, `shortcut_forged_valuation#0` 100.0%, `shortcut_sibling_off_books#0` 100.0%, `shortcut_skip_permit#0` 100.0%, `shortcut_stolen_stock#0` 100.0%, `sibling_money_ask#1` 100.0%, `sibling_second_ask#1` 100.0%, `skills_gated_bookkeeping#0` 100.0%, `uncle_tip_plot#1` 100.0%, `unexpected_medical_bill#2` 100.0%, `workplace_confrontation#1` 100.0%

**competent**: winning = no run reached $1M; top quartile by W468 net worth (>= $331,179); 75 runs.

`aunt_pressure_home#0` 100.0%, `bad_debt_helping#2` 100.0%, `community_dispute#0` 100.0%, `energy_transition_construction#0` 100.0%, `era1_gig_shock#0` 100.0%, `failed_hustle_food#1` 100.0%, `family_emergency_cost#2` 100.0%, `family_funeral_contribution#2` 100.0%, `first_partner_meet#1` 100.0%, `gig_opportunity_delivery#0` 100.0%, `grandmother_shoebox#2` 100.0%, `housing_repair#2` 100.0%, `job_offer_data_entry#1` 100.0%, `kingston_informal_market_event#1` 100.0%, `loan_refinance_offer#1` 100.0%, `market_theft#0` 100.0%, `meet_halima#1` 100.0%, `mid_decade_market_shift#0` 100.0%, `mobile_money_hustle#0` 100.0%, `neighbourhood_paint_contract#1` 100.0%, `phone_scam#0` 100.0%, `shortcut_bribe_queue#1` 100.0%, `shortcut_cash_no_receipt#1` 100.0%, `shortcut_forged_valuation#1` 100.0%, `shortcut_sibling_off_books#1` 100.0%, `shortcut_skip_permit#1` 100.0%, `shortcut_stolen_stock#1` 100.0%, `shortcut_underreport_income#1` 100.0%, `sibling_money_ask#2` 100.0%, `uncle_tip_plot#1` 100.0%, `unexpected_medical_bill#2` 100.0%

**passive**: winning = no run reached $1M; top quartile by W468 net worth (>= $62,035); 300 runs.

`aunt_pressure_home#2` 100.0%, `bad_debt_helping#2` 100.0%, `community_dispute#2` 100.0%, `energy_transition_construction#2` 100.0%, `era1_gig_shock#1` 100.0%, `failed_hustle_food#1` 100.0%, `family_emergency_cost#2` 100.0%, `family_funeral_contribution#2` 100.0%, `first_partner_meet#1` 100.0%, `followup_bribe_clerk_arrested#0` 100.0%, `followup_permit_raid#1` 100.0%, `followup_sibling_injury#2` 100.0%, `followup_tax_audit#2` 100.0%, `gig_opportunity_delivery#2` 100.0%, `grandmother_shoebox#2` 100.0%, `housing_repair#2` 100.0%, `job_offer_data_entry#1` 100.0%, `kingston_informal_market_event#2` 100.0%, `market_theft#1` 100.0%, `meet_halima#1` 100.0%, `mid_decade_market_shift#2` 100.0%, `mobile_money_hustle#1` 100.0%, `neighbourhood_paint_contract#2` 100.0%, `phone_scam#0` 100.0%, `shortcut_bribe_queue#1` 100.0%, `shortcut_cash_no_receipt#1` 100.0%, `shortcut_forged_valuation#2` 100.0%, `shortcut_sibling_off_books#0` 100.0%, `shortcut_skip_permit#0` 100.0%, `shortcut_stolen_stock#1` 100.0%, `shortcut_underreport_income#0` 100.0%, `sibling_money_ask#1` 100.0%, `sibling_second_ask#1` 100.0%, `uncle_tip_plot#1` 100.0%, `unexpected_medical_bill#2` 100.0%

**random**: winning = no run reached $1M; top quartile by W468 net worth (>= $-54,639); 75 runs.

none

## Pass/fail against CONCEPT targets

| ID | Target | Actual | Result |
|---|---|---|---|
| T1 | Competent median reaches $1M at age 27 to 30 | median age not reached; 0.0% of runs reached $1M; W468 median $329,771 | FAIL |
| T2 | Greedy median age at $1M lower than competent | greedy not reached vs competent not reached | FAIL |
| T3 | 50%+ of greedy runs fire a delayed consequence | 100.0% any; 100.0% major | PASS |
| T4 | Passive median net worth at W468 under $50K | $62,035 | FAIL |

## Recommended sim/config.ts changes

Hand-written by balance-qa from the SM-019 run (main merged at 997d3f5, 58 events). The tables above regenerate on every run. This section does not. Re-check it after any config or content change.

Every number below was verified with the what-if mode on seeds 0 to 299: `BALANCE_WHATIF='{"path.to.key":value,...}' npm run balance`. What-if patches CONFIG in memory only and does not write report.md.

### T1 and T2 miss: competent and greedy never reach $1M

Cause: income is linear. Competent nets about $730 per week late in the slice. Greedy nets about $1,060. Neither compounds. Competent needs about $2,500 per week to cross $1M near age 28.

Fix: multiply business income by 6. Multiply launch cost by 3 so payback stays above 3 weeks.

| Key | Old | New |
|---|---|---|
| `businesses.types[food_stall].weeklyIncomeUsd` | 180 | 1080 |
| `businesses.types[delivery_service].weeklyIncomeUsd` | 260 | 1560 |
| `businesses.types[short_term_rental].weeklyIncomeUsd` | 220 | 1320 |
| `businesses.types[content_brand].weeklyIncomeUsd` | 80 | 480 |
| `businesses.types[food_stall].launchCostUsd` | 2000 | 6000 |
| `businesses.types[delivery_service].launchCostUsd` | 3500 | 10500 |
| `businesses.types[short_term_rental].launchCostUsd` | 1500 | 4500 |
| `businesses.types[content_brand].launchCostUsd` | 500 | 1500 |

Measured with T4's fix included: competent median age at $1M = 28.3, with 100% of runs reaching it. Greedy = 26.3. A 5x income multiplier gives competent 29.4, too close to the age-30 edge. A 4x multiplier misses: competent W468 median is $887K.

### T4 miss: passive ends at $62,035

Cause: the full_time job at 40 hours nets $130 per week after rent and living costs.

| Key | Old | New |
|---|---|---|
| `cities.kingston.jobs[full_time].hourlyWageUsd` | 7.00 | 6.00 |

Measured: passive W468 = $43,355. A wage of 6.25 gives $48,025, which leaves too thin a margin. Competent and greedy stay the same, because both take the skilled job from week 1.

### Issues config cannot fix

1. Outcomes have almost no variance. Competent p10 to p90 at W468 spans $6K on $330K. Passive is identical across all 300 seeds, because its only randomness is the hustle roll and it does no hustle. Every strategy reaches its result in 100% or 0% of runs. Hour choices and event picks do not change the trajectory. That reads as a dead-state problem, not a tuning problem. Ticket for pm: add variance sources, such as a business income roll or market events with percentage effects.
2. Passive fires major consequences in 100% of runs. The "smallest effect" rule picks the shady option, because the clean option costs more: `shortcut_skip_permit` +$180 vs -$350, `shortcut_underreport_income` -$255 vs -$450, `shortcut_sibling_off_books` +$120 vs -$120. A cautious player drifts into crime by default. Ticket for lore-writer: make the clean option cost no more than the shady one, or tag the shady option with a visible risk.
3. T3 passes trivially under the ticket's definition. `loan_refinance_offer` (-$50) and `sibling_second_ask` (-$35) count as delayed consequences and fire in 100% of competent runs. The major-consequence column is the honest measure. Ticket for pm: let T3 count only major consequences.
4. `shortcut_loan_shark` (maxCashUsd 600) never reaches greedy, because greedy stays cash-rich. `shady_loan_collector` never fires for any scored strategy. `took_shady_loan` comes only from `followup_loan_shark_collects` #1.
5. No bankruptcy floor exists. Random runs reach -$57K median net worth and get evicted in 99.7% of runs, with nothing ending the life.
6. CONCEPT states the competent window as age 27 to 32. SM-019 scopes it to 27 to 30, because the slice ends at week 468 (age 30).
