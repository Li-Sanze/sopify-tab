#!/usr/bin/env bash
# Static/unit gate, then browser behavior.
# Exit 0: every required check passed.
# Exit 1: an assertion failed, Node is older than 22, the browser watchdog fired,
#         or SOPIFY_REQUIRE_BROWSER=1 and the browser binary was missing.
# Exit 2: browser binary is unavailable and SOPIFY_REQUIRE_BROWSER is not 1.
#         That is a skip, not a pass.
# Browser checks need Node with a global WebSocket (Node 22+).
node_major="$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)"
case "$node_major" in
  ''|*[!0-9]*) node_major=0 ;;
esac
if [[ "$node_major" -lt 22 ]]; then
  echo "reliability: Node 22+ is required (browser checks use the global WebSocket). Current: $(node -v 2>/dev/null || echo 'not found'). Install Node 22 or newer and re-run."
  exit 1
fi

set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "reliability: node $(node -v)"

fail=0
ran=()

is_browser() {
  case "$1" in
    host/test-w13-firstscreen.js|host/test-r1-r7-browser.js) return 0 ;;
    *) return 1 ;;
  esac
}

reap_sopify_chrome() {
  local pids dir
  # Match Chrome's own --user-data-dir path. Keep the needles out of one
  # process's argv so the scan cannot select itself.
  pids="$(ps -eo pid=,args= | grep -F -- '--user-data-dir=' | grep -F '/tmp/sopify-' | grep -v grep | awk '{ print $1 }')"
  if [[ -n "$pids" ]]; then
    echo "reliability: cleaning leftover chrome: ${pids//$'\n'/ }"
    # shellcheck disable=SC2086
    kill -KILL $pids 2>/dev/null || true
  fi
  shopt -s nullglob
  for dir in /tmp/sopify-r17-* /tmp/sopify-firstscreen-*; do
    rm -rf "$dir" 2>/dev/null || true
  done
  shopt -u nullglob
}

write_summary() {
  local exit_code="$1"
  local pass_n=0 fail_n=0 skip_n=0 row
  for row in "${ran[@]}"; do
    case "$row" in
      pass*) pass_n=$((pass_n + 1)) ;;
      fail*) fail_n=$((fail_n + 1)) ;;
      skip*) skip_n=$((skip_n + 1)) ;;
    esac
  done
  local total=${#ran[@]}
  printf 'reliability parts:\n'
  if [[ "$total" -gt 0 ]]; then
    printf '  %s\n' "${ran[@]}"
  fi
  echo "reliability summary: ${pass_n} pass, ${fail_n} fail, ${skip_n} skip, denominator ${total}"
  echo "reliability denominator: static and stub segments in this script. Real extension, Host, OS IME, and 3D runtime are not included."
  local summary_dir="${SOPIFY_ARTIFACT_DIR:-/tmp/sopify-reliability}"
  mkdir -p "$summary_dir"
  local summary_file="$summary_dir/reliability-parts.json"
  local require_browser=false
  if [[ "${SOPIFY_REQUIRE_BROWSER:-}" == "1" ]]; then
    require_browser=true
  fi
  {
    printf '{\n'
    printf '  "pass": %s,\n' "$pass_n"
    printf '  "fail": %s,\n' "$fail_n"
    printf '  "skip": %s,\n' "$skip_n"
    printf '  "denominator": %s,\n' "$total"
    printf '  "exitCode": %s,\n' "$exit_code"
    printf '  "node": "%s",\n' "$(node -v)"
    printf '  "requireBrowser": %s,\n' "$require_browser"
    printf '  "parts": [\n'
    local i=0
    for row in "${ran[@]}"; do
      i=$((i + 1))
      local comma=','
      if [[ "$i" -eq "$total" ]]; then comma=''; fi
      printf '    "%s"%s\n' "$row" "$comma"
    done
    printf '  ]\n}\n'
  } > "$summary_file"
  echo "reliability summary file: $summary_file"
}

run() {
  local name="$1"
  local start end elapsed status
  start=$(date +%s%N)
  echo "reliability: run ${name}"
  if is_browser "$name"; then
    timeout -k 10s 240s node "$name"
    status=$?
    reap_sopify_chrome
  else
    node "$name"
    status=$?
  fi
  end=$(date +%s%N)
  local elapsed_ms=$(( (end - start) / 1000000 ))
  printf -v elapsed '%d.%03d' $((elapsed_ms / 1000)) $((elapsed_ms % 1000))
  echo "reliability: section ${name} ${elapsed}s exit ${status}"
  if [[ "$status" -eq 0 ]]; then
    ran+=("pass ${name} ${elapsed}s")
    return 0
  fi
  if is_browser "$name" && [[ "$status" -eq 124 || "$status" -eq 137 ]]; then
    ran+=("fail ${name} watchdog ${elapsed}s")
    fail=1
    echo "reliability: ${name} exceeded the 240s browser watchdog"
    return 0
  fi
  if [[ "$status" -eq 2 ]]; then
    if [[ "${SOPIFY_REQUIRE_BROWSER:-}" == "1" ]]; then
      ran+=("fail ${name} exit 2 browser required ${elapsed}s")
      fail=1
      echo "reliability: browser required but unavailable (${name} exit 2)"
      return 0
    fi
    ran+=("skip ${name} ${elapsed}s")
    echo "reliability: browser unavailable (${name} exit 2)"
    write_summary 2
    exit 2
  fi
  ran+=("fail ${name} exit ${status} ${elapsed}s")
  fail=1
  return 0
}

trap reap_sopify_chrome EXIT

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

if [[ "$fail" -ne 0 ]]; then
  write_summary 1
  echo "reliability: failed"
  exit 1
fi
write_summary 0
echo "reliability: ok"
exit 0
