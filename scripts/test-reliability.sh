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
run host/test-r3-collection.js
run host/test-r3-form-retry.js
run host/test-r2-note-ack.js
run host/test-w11-resume.js
run host/test-w12-workset.js
run host/test-w4-theme.js
run host/test-sky-layers.js
run host/test-desk-companion.js
run extension/desk-3d/test-gates.js
run host/test-w13-firstscreen.js
run host/test-r1-r7-browser.js

pass_n=0
fail_n=0
skip_n=0
for row in "${ran[@]}"; do
  case "$row" in
    pass*) pass_n=$((pass_n + 1)) ;;
    fail*) fail_n=$((fail_n + 1)) ;;
    skip*) skip_n=$((skip_n + 1)) ;;
  esac
done
total=${#ran[@]}
printf 'reliability parts:\n'
printf '  %s\n' "${ran[@]}"
echo "reliability summary: ${pass_n} pass, ${fail_n} fail, ${skip_n} skip, denominator ${total}"
echo "reliability denominator: static and stub segments in this script. Real extension, Host, OS IME, and 3D runtime are not included."
summary_dir="${SOPIFY_ARTIFACT_DIR:-/tmp/sopify-reliability}"
mkdir -p "$summary_dir"
summary_file="$summary_dir/reliability-parts.json"
{
  printf '{\n'
  printf '  "pass": %s,\n' "$pass_n"
  printf '  "fail": %s,\n' "$fail_n"
  printf '  "skip": %s,\n' "$skip_n"
  printf '  "denominator": %s,\n' "$total"
  printf '  "exitCode": %s,\n' "$([[ "$fail" -ne 0 ]] && echo 1 || echo 0)"
  printf '  "parts": [\n'
  i=0
  for row in "${ran[@]}"; do
    i=$((i + 1))
    comma=','
    if [[ "$i" -eq "$total" ]]; then comma=''; fi
    printf '    "%s"%s\n' "$row" "$comma"
  done
  printf '  ]\n}\n'
} > "$summary_file"
echo "reliability summary file: $summary_file"
if [[ "$fail" -ne 0 ]]; then
  echo "reliability: failed"
  exit 1
fi
echo "reliability: ok"
exit 0
