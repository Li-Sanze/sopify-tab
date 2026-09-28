#!/usr/bin/env bash
# Static/unit gate, then browser behavior.
# Exit 0: both passed. Exit 1: an assertion failed. Exit 2: browser missing or could not start (skip, not a pass).
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0
node host/test-r1-r7.js || fail=1
node host/test-w11-resume.js || fail=1
node host/test-w12-workset.js || fail=1
node host/test-w4-theme.js || fail=1
node host/test-sky-layers.js || fail=1
node host/test-desk-companion.js || fail=1
node extension/desk-3d/test-gates.js || fail=1
node host/test-w13-firstscreen.js || fail=1

if [[ "$fail" -ne 0 ]]; then
  echo "reliability: static/unit failed"
  exit 1
fi

node host/test-r1-r7-browser.js
status=$?
if [[ "$status" -eq 0 ]]; then
  echo "reliability: ok"
elif [[ "$status" -eq 2 ]]; then
  echo "reliability: browser skipped"
else
  echo "reliability: browser checks failed"
fi
exit "$status"
