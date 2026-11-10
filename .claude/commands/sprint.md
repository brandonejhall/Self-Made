---
description: Run the next batch of Ready tickets through their owning agents.
---
Read docs/BACKLOG.md and docs/STATE.md. Take every ticket in "Ready" whose dependencies are Done.

For each ticket, use the subagent named in its Owner field. Tickets with no shared files and no dependency between them run in parallel, each in its own git worktree. Each agent works only on its ticket, makes the acceptance tests pass and commits with the ticket ID.

After all agents finish: merge the worktrees, run `npm test`, move finished tickets to Done, and report what shipped, what failed and why. If a milestone finished, run the balance-qa subagent next. Then stop.
