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
