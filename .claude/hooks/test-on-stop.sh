#!/usr/bin/env bash
# Runs the test suite whenever Claude or a subagent tries to finish.
# On failure it exits 2, which sends the failure back to the agent so it fixes
# the problem before stopping. If the agent is already continuing because of
# this hook (stop_hook_active), it lets the agent stop to avoid an endless loop.

input="$(cat)"
if echo "$input" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# Skip when dependencies are not installed yet.
[ -d node_modules ] || exit 0

out="$(npm test --silent 2>&1)"
status=$?
if [ $status -ne 0 ]; then
  echo "npm test failed. Fix the failures before finishing:" >&2
  echo "$out" | tail -40 >&2
  exit 2
fi

out="$(npx tsc --noEmit 2>&1)"
status=$?
if [ $status -ne 0 ]; then
  echo "Type check failed. Fix these errors before finishing:" >&2
  echo "$out" | tail -40 >&2
  exit 2
fi

exit 0
