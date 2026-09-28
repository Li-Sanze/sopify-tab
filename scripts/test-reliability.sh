#!/usr/bin/env bash
# Static/unit gate, then browser behavior.
# Exit 0: every required check passed.
# Exit 1: an assertion failed, or browser checks could not run for a reason other than a missing browser.
# Exit 2: browser binary is unavailable. That is a skip, not a pass.
# Browser checks need Node with a global WebSocket (Node 22+). Missing WebSocket is exit 1.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0
ran=()

run() {
  local name="$1"
  echo "reliability: run ${name}"
  node "$name"
  local status=$?
  if [[ "$status" -eq 0 ]]; then
    ran+=("pass ${name}")
    return 0
  fi
  if [[ "$status" -eq 2 ]]; then
    ran+=("skip ${name}")
    echo "reliability: browser unavailable (${name} exit 2)"
    printf 'reliability parts:\n'
    printf '  %s\n' "${ran[@]}"
    exit 2
  fi
  ran+=("fail ${name} exit ${status}")
  fail=1
  return 0
}

run host/test-r1-r7.js
run host/test-w11-resume.js
run host/test-w12-workset.js
run host/test-w4-theme.js
run host/test-sky-layers.js
run host/test-desk-companion.js
run extension/desk-3d/test-gates.js
run host/test-w13-firstscreen.js
run host/test-r1-r7-browser.js

printf 'reliability parts:\n'
printf '  %s\n' "${ran[@]}"
if [[ "$fail" -ne 0 ]]; then
  echo "reliability: failed"
  exit 1
fi
echo "reliability: ok"
exit 0
