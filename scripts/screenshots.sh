#!/usr/bin/env bash
# App Store screenshots in English and German from the iOS simulator.
#
#   scripts/screenshots.sh            build the sim app, shoot every screen in en + de
#   NO_BUILD=1 scripts/screenshots.sh reuse build/client-ios.app
#   DEVICE="Shots iPad 13" NO_BUILD=1 scripts/screenshots.sh   the iPad set
#
# Output: appstore/screenshots/<locale>/<display>/NN-name.png, ready for
# `python3 scripts/asc.py screenshots appstore/screenshots`:
#   "Shots iPhone 6.9" (iPhone 17 Pro Max, 1320×2868)  → APP_IPHONE_67
#   "Shots iPad 13"    (iPad Pro 13" M5, 2064×2752)    → APP_IPAD_PRO_3GEN_129
# Those are the two sizes App Store Connect requires; it scales them down
# for smaller devices.
#
# Content comes from two local demo CMS instances (English on :3144, German on
# :3145) filled by appstore/demo/seed.py; see appstore/demo/README.md. The app
# signs in through the simulator dev hooks (SKELPO_DEV_* user defaults, see
# devEnv in client/main.ts), SKELPO_LANG picks the language and
# SKELPO_DEV_HOST shows the local server as demo.skelpo.com. Simulator builds
# keep no keychain, so every launch starts signed out and signs in again.
set -euo pipefail
cd "$(dirname "$0")/.."

DEVICE="${DEVICE:-Shots iPhone 6.9}"
PASSWORD="${PASSWORD:-northwind-demo-2026}"
HOST="${HOST:-demo.skelpo.com}"
TYPE="${TYPE:-tour}"        # content type for the list / editor / Write shots
FIELD="${FIELD:-body}"      # its Markdown field for the Write shot
WAIT="${WAIT:-9}"           # seconds for sign-in + data to load
BUNDLE=com.skelpo.cmsadmin
OUT=appstore/screenshots
if [[ "$DEVICE" == *iPad* ]]; then DISPLAY_TYPE=APP_IPAD_PRO_3GEN_129; else DISPLAY_TYPE=APP_IPHONE_67; fi

UDID=$(xcrun simctl list devices -j | python3 -c "
import json,sys
for ds in json.load(sys.stdin)['devices'].values():
  for d in ds:
    if d['name'] == sys.argv[1] and d['isAvailable']: print(d['udid'])" "$DEVICE" | head -1)
[[ -n "$UDID" ]] || { echo "no simulator named '$DEVICE'"; exit 1; }

[[ -n "${NO_BUILD:-}" ]] || make sim
xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b >/dev/null
xcrun simctl install "$UDID" build/client-ios.app
xcrun simctl ui "$UDID" appearance light
xcrun simctl status_bar "$UDID" override --time 9:41 --dataNetwork wifi --wifiMode active --wifiBars 3 \
  --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100

defs() { xcrun simctl spawn "$UDID" defaults "$@"; }

# shot <locale> <file> [KEY=VALUE…]: fresh launch with these dev hooks, then a screenshot.
shot() {
  local loc=$1 name=$2; shift 2
  local lang=${loc%%-*}
  local site email
  if [[ $lang == de ]]; then site=http://127.0.0.1:3145 email=lena@demo.skelpo.com
  else site=http://127.0.0.1:3144 email=emma@demo.skelpo.com; fi
  [[ -z "${ONLY:-}" || "$name" == *"$ONLY"* ]] || return 0   # ONLY=home: just that screen
  xcrun simctl terminate "$UDID" "$BUNDLE" 2>/dev/null || true
  for k in TAB TYPE EDIT WRITE FOCUS ACTION; do defs delete "$BUNDLE" "SKELPO_DEV_$k" 2>/dev/null || true; done
  defs write "$BUNDLE" SKELPO_LANG "$lang"
  defs write "$BUNDLE" SKELPO_DEV_URL "$site"
  defs write "$BUNDLE" SKELPO_DEV_EMAIL "$email"
  defs write "$BUNDLE" SKELPO_DEV_HOST "$HOST"
  defs write "$BUNDLE" SKELPO_DEV_PASSWORD "$PASSWORD"
  for kv in "$@"; do defs write "$BUNDLE" "SKELPO_DEV_${kv%%=*}" "${kv#*=}"; done
  xcrun simctl launch "$UDID" "$BUNDLE" -AppleLanguages "($lang)" -AppleLocale "${loc/-/_}" >/dev/null
  sleep "$WAIT"
  mkdir -p "$OUT/$loc/$DISPLAY_TYPE"
  xcrun simctl io "$UDID" screenshot --type=png "$OUT/$loc/$DISPLAY_TYPE/$name.png" >/dev/null 2>&1
  echo "  $loc/$name"
}

LOCALES="${LOCALES:-en-US de-DE}"
for loc in $LOCALES; do
  [[ -n "${ONLY:-}" ]] || rm -rf "$OUT/$loc/$DISPLAY_TYPE"
  shot "$loc" 01-home    TAB=0
  shot "$loc" 02-content TYPE="$TYPE"
  shot "$loc" 03-editor  TYPE="$TYPE" EDIT=1
  # iPad edits Markdown inline in the editor, so it has no Write screen.
  [[ $DISPLAY_TYPE == APP_IPAD_PRO_3GEN_129 ]] || shot "$loc" 04-write TYPE="$TYPE" EDIT=1 WRITE="$FIELD"
  shot "$loc" 05-media   TAB=2
  shot "$loc" 06-inbox   TAB=3
done

# Leave the simulator clean: no stored password, no forced language.
xcrun simctl terminate "$UDID" "$BUNDLE" 2>/dev/null || true
for k in URL EMAIL PASSWORD HOST TAB TYPE EDIT WRITE FOCUS ACTION; do defs delete "$BUNDLE" "SKELPO_DEV_$k" 2>/dev/null || true; done
defs delete "$BUNDLE" SKELPO_LANG 2>/dev/null || true
xcrun simctl status_bar "$UDID" clear
echo "==> $OUT"
