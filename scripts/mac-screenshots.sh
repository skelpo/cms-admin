#!/usr/bin/env bash
# Mac App Store screenshots in English and German.
#
#   scripts/mac-screenshots.sh            build the macOS app, shoot every screen in en + de
#   NO_BUILD=1 scripts/mac-screenshots.sh reuse build/client.app
#
# Output: appstore/screenshots/<locale>/APP_DESKTOP/NN-name.png (2880×1800:
# the app window with its shadow, centred on a light background), ready for
# `ASC_PLATFORM=MAC_OS python3 scripts/asc.py screenshots appstore/screenshots`.
#
# Same demo content and dev hooks as scripts/screenshots.sh (local demo CMS on
# :3144 / :3145, see appstore/demo/README.md); here the hooks are passed as
# launch arguments. Light appearance is forced for the shots.
set -euo pipefail
cd "$(dirname "$0")/.."

PASSWORD="${PASSWORD:-northwind-demo-2026}"
HOST="${HOST:-demo.skelpo.com}"
TYPE="${TYPE:-tour}"
WAIT="${WAIT:-8}"
OUT=appstore/screenshots
D=APP_DESKTOP
APP=build/client.app
EXE="$APP/Contents/MacOS/client"
TMP=build/mac-shots
mkdir -p "$TMP"

[[ -n "${NO_BUILD:-}" ]] || make mac

# Window id of the app's main window, by owner PID.
cat > "$TMP/winid.swift" <<'SWIFT'
import CoreGraphics
import Foundation
let pid = Int32(CommandLine.arguments[1])!
let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String: Any]]
for w in list where (w[kCGWindowOwnerPID as String] as? Int32) == pid && (w[kCGWindowLayer as String] as? Int) == 0 {
  print(w[kCGWindowNumber as String] as! Int); break
}
SWIFT
xcrun swiftc -O "$TMP/winid.swift" -o "$TMP/winid" 2>/dev/null

compose() {  # compose <window.png> <out.png>
  python3 - "$1" "$2" <<'PY'
import sys
from PIL import Image
W, H = 2880, 1800
win = Image.open(sys.argv[1]).convert("RGBA")
s = min((W - 160) / win.width, (H - 120) / win.height, 1.0)
if s < 1:
    win = win.resize((round(win.width * s), round(win.height * s)), Image.LANCZOS)
bg = Image.new("RGBA", (W, H))
top, bot = (246, 244, 241), (232, 228, 223)
for y in range(H):
    t = y / (H - 1)
    bg.paste(tuple(round(a + (b - a) * t) for a, b in zip(top, bot)) + (255,), (0, y, W, y + 1))
bg.alpha_composite(win, ((W - win.width) // 2, (H - win.height) // 2))
bg.convert("RGB").save(sys.argv[2])
PY
}

shot() {  # shot <locale> <name> [KEY=VALUE…]
  local loc=$1 name=$2; shift 2
  local lang=${loc%%-*} site email
  if [[ $lang == de ]]; then site=http://127.0.0.1:3145 email=lena@demo.skelpo.com
  else site=http://127.0.0.1:3144 email=emma@demo.skelpo.com; fi
  [[ -z "${ONLY:-}" || "$name" == *"$ONLY"* ]] || return 0
  pkill -f "$EXE" 2>/dev/null || true; sleep 1
  # Hooks as launch arguments (NSArgumentDomain): written with `defaults`
  # they don't reliably reach the app once a sandboxed build has run.
  local args=(-SKELPO_LANG "$lang" -SKELPO_DEV_URL "$site" -SKELPO_DEV_EMAIL "$email"
              -SKELPO_DEV_HOST "$HOST" -SKELPO_DEV_PASSWORD "$PASSWORD")
  for kv in "$@"; do args+=("-SKELPO_DEV_${kv%%=*}" "${kv#*=}"); done
  "$EXE" "${args[@]}" -NSRequiresAquaSystemAppearance YES -AppleLanguages "($lang)" -AppleLocale "${loc/-/_}" >/dev/null 2>&1 &
  local pid=$!
  sleep "$WAIT"
  local wid; wid=$("$TMP/winid" "$pid")
  [[ -n "$wid" ]] || { echo "no window for $loc/$name"; kill "$pid"; return 1; }
  screencapture -x -l"$wid" "$TMP/$loc-$name.png"
  mkdir -p "$OUT/$loc/$D"
  compose "$TMP/$loc-$name.png" "$OUT/$loc/$D/$name.png"
  kill "$pid" 2>/dev/null || true
  echo "  $loc/$name"
}

LOCALES="${LOCALES:-en-US de-DE}"
for loc in $LOCALES; do
  [[ -n "${ONLY:-}" ]] || rm -rf "$OUT/$loc/$D"
  shot "$loc" 01-home    TAB=0
  shot "$loc" 02-content TYPE="$TYPE"
  shot "$loc" 03-editor  TYPE="$TYPE" EDIT=1
  shot "$loc" 05-media   TAB=2
  shot "$loc" 06-inbox   TAB=3
done

pkill -f "$EXE" 2>/dev/null || true
echo "==> $OUT/*/$D"
