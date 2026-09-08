#!/usr/bin/env bash
# Install com.sopify.tab for this machine. Snapshots absolute Node,
# cursor-agent-proxy, and optional claude paths. Does not touch Codex /
# Qoder host manifests. Missing claude is fine — Host still installs.
set -euo pipefail

HOST_ID='com.sopify.tab'
EXT_ID='cgkhllpelkjmfamddkjpnmchjikdcbgp'
ORIGIN="chrome-extension://${EXT_ID}/"
FORBIDDEN_HOSTS='com.openai.codexextension com.qoder.work.connector'
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_JS="${SCRIPT_DIR}/host.js"
LIB_DIR="${SOPIFY_HOST_LIB:-${HOME}/.local/lib/sopify-tab}"

die() { echo "install-host: $*" >&2; exit 1; }

[ -f "$SRC_JS" ] || die "missing ${SRC_JS}"

abspath() {
  python3 -c 'import os,sys; print(os.path.abspath(os.path.expanduser(sys.argv[1])))' "$1"
}

realpath_of() {
  python3 -c 'import os,sys; print(os.path.realpath(os.path.abspath(os.path.expanduser(sys.argv[1]))))' "$1"
}

is_version_dir() {
  case "$1" in
    */cursor-agent/versions/*|*/.local/share/cursor-agent/versions/*) return 0 ;;
    *) return 1 ;;
  esac
}

assert_safe_path() {
  local p="$1"
  case "$p" in
    /*) ;;
    *) die "path must be absolute: $p" ;;
  esac
  case "$p" in
    *$'\n'*|*\'*|*'\"'*) die "unsafe characters in path: $p" ;;
  esac
}

snapshot_node() {
  local raw="$1"
  [ -n "$raw" ] || die "未找到 node。可用 SOPIFY_NODE 指定绝对路径。"
  local abs
  abs="$(realpath_of "$raw")"
  assert_safe_path "$abs"
  [ -x "$abs" ] || die "node 不可执行: $abs"
  case "$(basename "$abs")" in
    env) die "拒绝把 /usr/bin/env 当作 node" ;;
  esac
  case "$abs" in
    */usr/bin/env|*/bin/env) die "拒绝把 env 当作 node" ;;
  esac
  if is_version_dir "$abs"; then
    die "拒绝快照 cursor-agent 版本目录: $abs"
  fi
  "$abs" -e 'process.exit(0)' >/dev/null || die "node 无法拉起: $abs"
  printf '%s' "$abs"
}

snapshot_proxy() {
  local raw="$1"
  [ -n "$raw" ] || die "未找到 cursor-agent-proxy。需要 ~/.local/bin/cursor-agent-proxy，或设 SOPIFY_CURSOR_AGENT_PROXY。"
  local abs
  abs="$(abspath "$raw")"
  assert_safe_path "$abs"
  if is_version_dir "$abs"; then
    die "拒绝快照 cursor-agent 版本目录: $abs"
  fi
  [ -e "$abs" ] || die "cursor-agent-proxy 不存在: $abs"
  [ -x "$abs" ] || die "cursor-agent-proxy 不可执行: $abs"
  local resolved
  resolved="$(realpath_of "$abs")"
  if is_version_dir "$resolved"; then
    # Keep the stable bin path; do not write the versions target.
    printf '%s' "$abs"
    return
  fi
  printf '%s' "$abs"
}

find_node() {
  if [ -n "${SOPIFY_NODE:-}" ]; then
    printf '%s' "$SOPIFY_NODE"
    return
  fi
  command -v node 2>/dev/null || true
}

find_proxy() {
  if [ -n "${SOPIFY_CURSOR_AGENT_PROXY:-}" ]; then
    printf '%s' "$SOPIFY_CURSOR_AGENT_PROXY"
    return
  fi
  if [ -x "${HOME}/.local/bin/cursor-agent-proxy" ]; then
    printf '%s' "${HOME}/.local/bin/cursor-agent-proxy"
    return
  fi
  command -v cursor-agent-proxy 2>/dev/null || true
}

find_claude() {
  if [ -n "${SOPIFY_CLAUDE:-}" ]; then
    printf '%s' "$SOPIFY_CLAUDE"
    return
  fi
  if [ -x "${HOME}/.local/bin/claude" ]; then
    printf '%s' "${HOME}/.local/bin/claude"
    return
  fi
  command -v claude 2>/dev/null || true
}

snapshot_claude() {
  local raw="$1"
  [ -n "$raw" ] || return 0
  local abs
  abs="$(abspath "$raw")"
  assert_safe_path "$abs"
  if is_version_dir "$abs"; then
    die "拒绝快照 cursor-agent 版本目录: $abs"
  fi
  [ -e "$abs" ] || die "claude 不存在: $abs"
  [ -x "$abs" ] || die "claude 不可执行: $abs"
  local resolved
  resolved="$(realpath_of "$abs")"
  if is_version_dir "$resolved"; then
    printf '%s' "$abs"
    return
  fi
  printf '%s' "$abs"
}

nmh_dirs() {
  case "$(uname -s)" in
    Darwin)
      echo "${HOME}/Library/Application Support/Google/Chrome/NativeMessagingHosts"
      if [ -d "${HOME}/Library/Application Support/Google/Chrome Canary" ]; then
        echo "${HOME}/Library/Application Support/Google/Chrome Canary/NativeMessagingHosts"
      fi
      if [ -d "${HOME}/Library/Application Support/Chromium" ]; then
        echo "${HOME}/Library/Application Support/Chromium/NativeMessagingHosts"
      fi
      ;;
    *)
      echo "${HOME}/.config/google-chrome/NativeMessagingHosts"
      local d
      for d in "${HOME}/.config"/google-chrome-* "${HOME}/.config/chromium"; do
        if [ -d "$d" ]; then
          echo "${d}/NativeMessagingHosts"
        fi
      done
      ;;
  esac
}

assert_not_forbidden_name() {
  local base="$1"
  local bad
  for bad in $FORBIDDEN_HOSTS; do
    if [ "$base" = "${bad}.json" ]; then
      die "拒绝写入 ${bad} 清单"
    fi
  done
  if [ "$base" != "${HOST_ID}.json" ]; then
    die "只会写入 ${HOST_ID}.json，拒绝 ${base}"
  fi
}

checksum_forbidden() {
  python3 - <<'PY'
import hashlib, os
home = os.path.expanduser("~")
names = ("com.openai.codexextension.json", "com.qoder.work.connector.json")
roots = []
for rel in (
    ".config/google-chrome/NativeMessagingHosts",
    ".config/chromium/NativeMessagingHosts",
    "Library/Application Support/Google/Chrome/NativeMessagingHosts",
    "Library/Application Support/Chromium/NativeMessagingHosts",
):
    roots.append(os.path.join(home, rel))
for d in list(roots):
    parent = os.path.dirname(d)
    base = os.path.dirname(parent)
    if os.path.isdir(base):
        for name in os.listdir(base):
            if name.startswith("google-chrome"):
                roots.append(os.path.join(base, name, "NativeMessagingHosts"))
seen = set()
for root in roots:
    if root in seen or not os.path.isdir(root):
        continue
    seen.add(root)
    for name in names:
        p = os.path.join(root, name)
        if os.path.isfile(p):
            h = hashlib.sha256(open(p, "rb").read()).hexdigest()
            print(f"{p}\t{h}")
PY
}

write_nmh() {
  local dest="$1"
  local wrapper="$2"
  local base
  base="$(basename "$dest")"
  assert_not_forbidden_name "$base"
  mkdir -p "$(dirname "$dest")"
  python3 - "$dest" "$HOST_ID" "$wrapper" "$ORIGIN" <<'PY'
import json, sys
dest, name, wrapper, origin = sys.argv[1:5]
doc = {
    "name": name,
    "description": "Sopify Tab native host",
    "path": wrapper,
    "type": "stdio",
    "allowed_origins": [origin],
}
with open(dest, "w", encoding="utf-8") as f:
    json.dump(doc, f, indent=2)
    f.write("\n")
PY
}

NODE_RAW="$(find_node)"
PROXY_RAW="$(find_proxy)"
CLAUDE_RAW="$(find_claude)"
NODE_ABS="$(snapshot_node "$NODE_RAW")"
PROXY_ABS="$(snapshot_proxy "$PROXY_RAW")"
CLAUDE_ABS=""
if [ -n "$CLAUDE_RAW" ]; then
  CLAUDE_ABS="$(snapshot_claude "$CLAUDE_RAW")"
fi

mkdir -p "$LIB_DIR"
cp "$SRC_JS" "${LIB_DIR}/host.js"
HOST_JS="$(abspath "${LIB_DIR}/host.js")"
WRAPPER="${LIB_DIR}/run"
assert_safe_path "$HOST_JS"
assert_safe_path "$WRAPPER"

cat > "$WRAPPER" <<EOF
#!/bin/sh
exec '${NODE_ABS}' '${HOST_JS}' "\$@"
EOF
chmod 755 "$WRAPPER"

if grep -q '/usr/bin/env node' "$WRAPPER"; then
  die "包装脚本不能使用 /usr/bin/env node"
fi
if is_version_dir "$NODE_ABS" || is_version_dir "$PROXY_ABS"; then
  die "快照路径落在版本目录"
fi
if [ -n "$CLAUDE_ABS" ] && is_version_dir "$CLAUDE_ABS"; then
  die "快照路径落在版本目录"
fi

BEFORE_FORBIDDEN="$(checksum_forbidden || true)"

python3 - "$LIB_DIR/local-paths.json" "$NODE_ABS" "$PROXY_ABS" "$HOST_JS" "$WRAPPER" "$EXT_ID" "$HOST_ID" "$CLAUDE_ABS" <<'PY'
import json, sys
dest, node, proxy, host_js, wrapper, ext_id, host_id = sys.argv[1:8]
claude = sys.argv[8] if len(sys.argv) > 8 else ""
doc = {
    "node": node,
    "cursorAgentProxy": proxy,
    "hostJs": host_js,
    "wrapper": wrapper,
    "extensionId": ext_id,
    "hostId": host_id,
}
if claude:
    doc["claudeBin"] = claude
with open(dest, "w", encoding="utf-8") as f:
    json.dump(doc, f, indent=2)
    f.write("\n")
PY
cp "${LIB_DIR}/local-paths.json" "${SCRIPT_DIR}/local-paths.json"

WRITTEN=0
while IFS= read -r dir; do
  [ -n "$dir" ] || continue
  write_nmh "${dir}/${HOST_ID}.json" "$WRAPPER"
  WRITTEN=$((WRITTEN + 1))
done < <(nmh_dirs | awk 'NF && !seen[$0]++')

[ "$WRITTEN" -gt 0 ] || die "没有可写的 NativeMessagingHosts 目录"

AFTER_FORBIDDEN="$(checksum_forbidden || true)"
if [ "$BEFORE_FORBIDDEN" != "$AFTER_FORBIDDEN" ]; then
  die "检测到 Codex / Qoder host 清单被改动，已中止"
fi

echo "已安装 ${HOST_ID}"
echo "  node   ${NODE_ABS}"
echo "  proxy  ${PROXY_ABS}"
if [ -n "$CLAUDE_ABS" ]; then
  echo "  claude ${CLAUDE_ABS}"
else
  echo "  claude （未找到，可选；不影响 Cursor）"
fi
echo "  run    ${WRAPPER}"
echo "  origin ${ORIGIN}"
echo "书桌不依赖这次安装。Chrome 里打开设置再点「检测 Host」。"
