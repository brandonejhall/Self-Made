# Balance Report (SM-025)

Seeds 0 to 299 per strategy (300 runs each), city kingston, 468 weeks. Reproduce one run with `newGame(seed, "kingston")` and the strategy in `tests/balance/run.ts`.
Events loaded: 58 from 8 files. Delayed-consequence events (requiresTags + minYearsAfterTag): `shady_loan_collector`, `ex_partner_competitor`, `eviction_insurance_block`, `sibling_second_ask`, `loan_refinance_offer`, `followup_loan_shark_collects`, `followup_partner_sues`, `followup_permit_raid`, `followup_tax_audit`, `followup_stolen_phones_traced`, `followup_bribe_clerk_arrested`, `followup_forged_valuation_exposed`, `followup_sibling_injury`, `followup_tobias_calls_ledger`.
Runtime: 7.4 s for 1200 runs.

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
| greedy | $134,532 | $158,483 | $185,671 | $704,231 | $887,512 | $987,457 | $1,522,076 | $1,803,787 | $1,977,688 |
| competent | $115,265 | $164,543 | $174,348 | $452,064 | $679,443 | $717,825 | $925,555 | $1,206,505 | $1,330,490 |
| passive | $22,275 | $22,275 | $22,275 | $41,755 | $41,755 | $41,755 | $62,035 | $62,035 | $62,035 |
| random | $-18,713 | $-13,720 | $-9,137 | $-40,671 | $-35,922 | $-30,053 | $-62,512 | $-57,522 | $-51,022 |

## $1M, evictions, delayed consequences

| Strategy | Median age at $1M | Runs reaching $1M | Eviction rate | Runs with >=1 delayed consequence | Runs with >=1 major delayed consequence |
|---|---|---|---|---|---|
| greedy | 27.4 | 300 / 300 (100.0%) | 0.0% | 300 / 300 (100.0%) | 300 / 300 (100.0%) |
| competent | 28.7 | 255 / 300 (85.0%) | 0.0% | 300 / 300 (100.0%) | 0 / 300 (0.0%) |
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

## Business stages and property

Growth rules: competent reinvests the full remaining stage requirement and buys property (min 20% down, 1040-week mortgage, most expensive affordable type, up to 3) only when cash afterward covers 8 weeks of costs. Greedy does the same with a 2-week buffer. Passive never launches, reinvests or buys. Random launches at random and never reinvests or buys. Weekly costs = rent + living + loan and mortgage payments + property maintenance.

Median age at the first week any owned business sits at stage N. Not reached = the median run never got there by W468.

| Strategy | Stage 1 (Startup) | Stage 2 (Established) | Stage 3 (Growing) | Stage 4 (Scaled) | Props W156 | Props W312 | Props W468 |
|---|---|---|---|---|---|---|---|
| greedy | 22.2 (100.0%) | 22.7 (100.0%) | 23.7 (100.0%) | 25.3 (100.0%) | 3 | 3 | 3 |
| competent | 21.8 (100.0%) | 22.3 (100.0%) | 23.3 (100.0%) | 24.8 (100.0%) | 3 | 3 | 3 |
| passive | not reached (0.0%) | not reached (0.0%) | not reached (0.0%) | not reached (0.0%) | 0 | 0 | 0 |
| random | not reached (0.3%) | not reached (0.0%) | not reached (0.0%) | not reached (0.0%) | 0 | 0 | 0 |

Percent in parentheses = share of runs that reached the stage. Props = median properties owned.

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

**greedy**: winning = reached $1M by week 468; 300 runs.

`aunt_pressure_home#0` 100.0%, `bad_debt_helping#2` 100.0%, `community_dispute#0` 100.0%, `energy_transition_construction#0` 100.0%, `era1_gig_shock#0` 100.0%, `ex_partner_competitor#0` 100.0%, `failed_hustle_food#1` 100.0%, `family_emergency_cost#2` 100.0%, `family_funeral_contribution#2` 100.0%, `first_partner_meet#0` 100.0%, `followup_bribe_clerk_arrested#0` 100.0%, `followup_forged_valuation_exposed#1` 100.0%, `followup_permit_raid#1` 100.0%, `followup_sibling_injury#2` 100.0%, `followup_stolen_phones_traced#2` 100.0%, `followup_tax_audit#2` 100.0%, `gig_opportunity_delivery#0` 100.0%, `grandmother_land_dispute#1` 100.0%, `grandmother_shoebox#0` 100.0%, `halima_hustle_tip#0` 100.0%, `housing_repair#2` 100.0%, `job_offer_data_entry#0` 100.0%, `kingston_informal_market_event#1` 100.0%, `loan_refinance_offer#1` 100.0%, `market_theft#0` 100.0%, `meet_halima#0` 100.0%, `mid_decade_market_shift#0` 100.0%, `mobile_money_hustle#0` 100.0%, `neighbourhood_paint_contract#1` 100.0%, `partner_direction_conflict#2` 100.0%, `partner_financial_ask#1` 100.0%, `partner_hand_invite#1` 100.0%, `phone_scam#0` 100.0%, `shortcut_bribe_queue#0` 100.0%, `shortcut_cash_no_receipt#0` 100.0%, `shortcut_forged_valuation#0` 100.0%, `shortcut_sibling_off_books#0` 100.0%, `shortcut_skip_permit#0` 100.0%, `shortcut_stolen_stock#0` 100.0%, `sibling_money_ask#1` 100.0%, `sibling_second_ask#1` 100.0%, `skills_gated_bookkeeping#0` 100.0%, `uncle_tip_plot#1` 100.0%, `unexpected_medical_bill#2` 100.0%, `workplace_confrontation#1` 100.0%, `quick_flip_shoes#2` 86.3%, `resale_market_find#2` 85.3%, `business_tip_neighbour#2` 81.3%

**competent**: winning = reached $1M by week 468; 255 runs.

`aunt_pressure_home#0` 100.0%, `bad_debt_helping#2` 100.0%, `community_dispute#0` 100.0%, `energy_transition_construction#0` 100.0%, `era1_gig_shock#0` 100.0%, `failed_hustle_food#1` 100.0%, `family_emergency_cost#2` 100.0%, `family_funeral_contribution#2` 100.0%, `first_partner_meet#1` 100.0%, `gig_opportunity_delivery#0` 100.0%, `grandmother_shoebox#2` 100.0%, `housing_repair#2` 100.0%, `job_offer_data_entry#1` 100.0%, `kingston_informal_market_event#1` 100.0%, `loan_refinance_offer#1` 100.0%, `market_theft#0` 100.0%, `meet_halima#1` 100.0%, `mid_decade_market_shift#0` 100.0%, `mobile_money_hustle#0` 100.0%, `neighbourhood_paint_contract#1` 100.0%, `phone_scam#0` 100.0%, `shortcut_bribe_queue#1` 100.0%, `shortcut_cash_no_receipt#1` 100.0%, `shortcut_forged_valuation#1` 100.0%, `shortcut_sibling_off_books#1` 100.0%, `shortcut_skip_permit#1` 100.0%, `shortcut_stolen_stock#1` 100.0%, `shortcut_underreport_income#1` 100.0%, `sibling_money_ask#2` 100.0%, `uncle_tip_plot#1` 100.0%, `unexpected_medical_bill#2` 100.0%

**passive**: winning = no run reached $1M; top quartile by W468 net worth (>= $62,035); 300 runs.

`aunt_pressure_home#2` 100.0%, `bad_debt_helping#2` 100.0%, `community_dispute#2` 100.0%, `energy_transition_construction#2` 100.0%, `era1_gig_shock#1` 100.0%, `failed_hustle_food#1` 100.0%, `family_emergency_cost#2` 100.0%, `family_funeral_contribution#2` 100.0%, `first_partner_meet#1` 100.0%, `followup_bribe_clerk_arrested#0` 100.0%, `followup_permit_raid#1` 100.0%, `followup_sibling_injury#2` 100.0%, `followup_tax_audit#2` 100.0%, `gig_opportunity_delivery#2` 100.0%, `grandmother_shoebox#2` 100.0%, `housing_repair#2` 100.0%, `job_offer_data_entry#1` 100.0%, `kingston_informal_market_event#2` 100.0%, `market_theft#1` 100.0%, `meet_halima#1` 100.0%, `mid_decade_market_shift#2` 100.0%, `mobile_money_hustle#1` 100.0%, `neighbourhood_paint_contract#2` 100.0%, `phone_scam#0` 100.0%, `shortcut_bribe_queue#1` 100.0%, `shortcut_cash_no_receipt#1` 100.0%, `shortcut_forged_valuation#2` 100.0%, `shortcut_sibling_off_books#0` 100.0%, `shortcut_skip_permit#0` 100.0%, `shortcut_stolen_stock#1` 100.0%, `shortcut_underreport_income#0` 100.0%, `sibling_money_ask#1` 100.0%, `sibling_second_ask#1` 100.0%, `uncle_tip_plot#1` 100.0%, `unexpected_medical_bill#2` 100.0%

**random**: winning = no run reached $1M; top quartile by W468 net worth (>= $-54,639); 75 runs.

none

## Pass/fail against CONCEPT targets

| ID | Target | Actual | Result |
|---|---|---|---|
| T1 | Competent median reaches $1M at age 27 to 30 | median age 28.7; 85.0% of runs reached $1M; W468 median $1,206,505 | PASS |
| T2 | Greedy median age at $1M lower than competent | greedy 27.4 vs competent 28.7 | PASS |
| T3 | 50%+ of greedy runs fire a major delayed consequence | 100.0% major; 100.0% any | PASS |
| T4 | Passive median net worth at W468 under $50K | $62,035 | FAIL |

## Recommended sim/config.ts changes

Hand-written by balance-qa from the SM-025 run (main at 877e9f4, strategies now use `reinvestBusiness`, `buyProperty` and 1040-week mortgages). The tables above regenerate on every run. This section does not. Re-check it after any config or content change.

Every number below was verified with the what-if mode on seeds 0 to 299: `BALANCE_WHATIF='{"path.to.key":value,...}' npm run balance`. What-if patches CONFIG in memory only and does not write report.md.

T3 now counts major delayed consequences only, per SM-025. The "any delayed consequence" rate stays in the table for reference.

### Withdrawn: the SM-019 6x business income change

SM-019 recommended 6x `weeklyIncomeUsd` and 3x `launchCostUsd` on all 4 business types. Growth stages and rental property now carry competent and greedy past $1M with current config. Competent reaches $1M at a median age of 28.7. Greedy reaches it at 27.4. Do not apply the SM-019 business changes.

### T4 miss: passive ends at $62,035

Cause: the full_time job at 40 hours nets $130 per week after rent and living costs. Passive never touches business or property, so only the wage moves it.

| Key | Old | New |
|---|---|---|
| `cities.kingston.jobs[full_time].hourlyWageUsd` (index 2) | 7.00 | 6.00 |

What-if sweep on this one key:

| full_time wage | Passive W468 median | T4 |
|---|---|---|
| 7.00 (current) | $62,035 | FAIL |
| 6.50 | $52,695 | FAIL |
| 6.25 | $48,025 | PASS, $1,975 margin |
| 6.00 | $43,355 | PASS, $6,645 margin |

6.00 is the recommendation. It also keeps passive under the checkpoint guide rails: $16,075 at W156 (rail $20,000) and $29,315 at W312 (rail $35,000). Competent and greedy numbers do not change at any of these wages.

### Verified full set

The full set is the single change above: `BALANCE_WHATIF='{"cities.kingston.jobs.2.hourlyWageUsd":6}' npm run balance`.

| ID | Target | Actual with full_time wage 6.00 | Result |
|---|---|---|---|
| T1 | Competent median reaches $1M at age 27 to 30 | median age 28.7; 85.0% of runs reached $1M; W468 median $1,206,505 | PASS |
| T2 | Greedy median age at $1M lower than competent | greedy 27.4 vs competent 28.7 | PASS |
| T3 | 50%+ of greedy runs fire a major delayed consequence | 100.0% major; 100.0% any | PASS |
| T4 | Passive median net worth at W468 under $50K | $43,355 | PASS |

### Issues config cannot fix

1. Growth saturates early. Competent reaches business stage 4 at a median age of 24.8 and owns the 3-property cap by W156 (age 24). Greedy hits both by age 25.3. From then on neither strategy has a growth decision left, which reads as a dead state for ages 25 to 30. Ticket for pm: add Stage 1 sinks past Scaled, such as more property slots, a stage 5 or new business types gated on owning a Scaled business.
2. Competent misses $1M in 15% of runs. W156 p10 is $115,265 vs a median of $164,543, which points to an early business failure that the strategy recovers from too slowly. T1 still passes on the median.
3. Outcomes for passive have zero variance. All 300 seeds end at the same number, because passive does no hustle and owns nothing. Ticket for pm: add a variance source for wage workers, such as raises, layoffs or medical events.
4. Passive fires major consequences in 100% of runs. The "smallest effect" rule picks the shady option, because the clean option costs more: `shortcut_skip_permit` +$180 vs -$350, `shortcut_underreport_income` -$255 vs -$450, `shortcut_sibling_off_books` +$120 vs -$120. Ticket for lore-writer: make the clean option cost no more than the shady one, or tag the shady option with a visible risk.
5. `shortcut_loan_shark` (maxCashUsd 600) never reaches greedy, because greedy stays cash-rich. `shady_loan_collector` never fires for any scored strategy.
6. No bankruptcy floor exists. Random runs reach -$57K median net worth and get evicted in 99.7% of runs, with nothing ending the life.
7. CONCEPT states the competent window as age 27 to 32. SM-019 scopes it to 27 to 30, because the slice ends at week 468 (age 30). The suite runs 300 seeds per strategy per the 2026-11-09 human decision in docs/STATE.md, not the 1,000 in the balance-qa brief.
