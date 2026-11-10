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
