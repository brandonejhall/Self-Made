---
description: Tune sim/config.ts until the balance targets in CONCEPT.md pass, without a human in the loop.
argument-hint: optional max rounds (default 5)
---
Max rounds: "$ARGUMENTS". If that is empty or not a number, use 5. Run an autotune loop for at most that many rounds.

Each round:
1. Use the balance-qa subagent. It runs `npm run balance`, compares the report against the balance target in docs/CONCEPT.md, and lists every miss with exact recommended changes to sim/config.ts (old value, new value, expected effect).
2. If every target passes, stop and report the final numbers.
3. Otherwise use the sim-engineer subagent to apply only the recommended config changes, run `npm test`, and commit as `TUNE-<round>: <one-line summary>`.

Rules:
- Only sim/config.ts changes during autotune. No logic changes. If a target cannot be met by config alone, stop and report which system needs a ticket.
- Never change one value by more than 50% in a single round.
- Log each round in docs/STATE.md under "Decision log": values changed and the metric movement.

At the end, show a table: round, values changed, each target's result.
