#!/usr/bin/env bash
# Prefer: chrome://extensions → Developer mode → Load unpacked → <repo>/extension/
#
# Google Chrome 148+ prints:
#   "--load-extension is not allowed in Google Chrome, ignoring."
# Do NOT rely on branded Chrome CLI for acceptance. Use Load unpacked, or Chromium
# with --disable-features=DisableLoadExtensionCommandLineSwitch when that flag works.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXT="$ROOT/extension"
PROFILE="${SOPIFY_PROFILE:-$HOME/sopify-tab-clean-profile}"
PORT="${SOPIFY_CDP_PORT:-9444}"

if [[ ! -f "$EXT/manifest.json" ]]; then
  echo "missing $EXT/manifest.json — select the extension/ folder, not the repo root" >&2
  exit 1
fi

pick_bin() {
  if [[ -n "${CHROME_BIN:-}" && -x "${CHROME_BIN}" ]]; then
    echo "$CHROME_BIN"; return
  fi
  for c in chromium chromium-browser /usr/bin/chromium /usr/bin/chromium-browser; do
    if command -v "$c" >/dev/null 2>&1 || [[ -x "$c" ]]; then
      echo "$c"; return
    fi
  done
  # Branded Chrome: CLI --load-extension is ignored on 148+; still usable for UI Load unpacked.
  if [[ -x /usr/bin/google-chrome-stable ]]; then
    echo /usr/bin/google-chrome-stable; return
  fi
  echo "google-chrome"
}

BIN="$(pick_bin)"
mkdir -p "$PROFILE"
echo "binary=$BIN"
echo "profile=$PROFILE"
echo "extension=$EXT"
echo
echo "NOTE: On Google Chrome 148+, --load-extension is ignored."
echo "      Acceptance path: chrome://extensions → Load unpacked → $EXT"
echo

EXTRA=()
case "$BIN" in
  *chromium*)
    EXTRA+=(--disable-features=DisableLoadExtensionCommandLineSwitch)
    EXTRA+=(--load-extension="$EXT")
    EXTRA+=(--disable-extensions-except="$EXT")
    ;;
  *)
    # Branded Chrome: do not pretend CLI load works.
    ;;
esac

exec "$BIN" \
  --no-sandbox \
  --test-type \
  --disable-dev-shm-usage \
  --use-gl=angle \
  --use-angle=swiftshader-webgl \
  --password-store=basic \
  --no-first-run \
  --no-default-browser-check \
  --disable-sync \
  --remote-debugging-port="$PORT" \
  --remote-allow-origins=\* \
  --user-data-dir="$PROFILE" \
  "${EXTRA[@]}" \
  "$@"
