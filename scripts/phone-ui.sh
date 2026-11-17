#!/usr/bin/env bash
# Talk to the geisterhand UI driver inside the app on a connected iPhone
# (development build from `UI_DRIVER=1 scripts/devphone.sh`), over Wi-Fi.
#
#   scripts/phone-ui.sh widgets                 list widgets (handle, label)
#   scripts/phone-ui.sh click <handle>          tap a widget
#   scripts/phone-ui.sh type <handle> <text>    type into a field
#   scripts/phone-ui.sh screenshot out.png      PNG of the app
#   scripts/phone-ui.sh get <path>              raw GET, e.g. /health
set -euo pipefail
# The driver listens on IPv4 only, so use the phone's Wi-Fi address (same
# network as this Mac); PHONE_HOST overrides.
HOST="${PHONE_HOST:-$(dscacheutil -q host -a name Ralphs-iPhone.local 2>/dev/null | awk '/ip_address/ {print $2; exit}')}"
[[ -n "$HOST" ]] || { echo "phone not found on the network (set PHONE_HOST)"; exit 1; }
BASE="http://$HOST:7676"
case "${1:-}" in
  widgets) curl -s -m 10 "$BASE/widgets" | python3 -c '
import json,sys
for w in json.load(sys.stdin):
    print(w["handle"], w.get("label",""), "(tappable)" if w.get("callback_kind") else "")' ;;
  click) curl -s -m 10 -X POST "$BASE/click/$2"; echo ;;
  type) curl -s -m 10 -X POST "$BASE/type/$2" --data-binary "$3"; echo ;;
  screenshot) curl -s -m 30 "$BASE/screenshot" -o "${2:-phone.png}"; file "${2:-phone.png}" ;;
  get) curl -s -m 10 "$BASE$2"; echo ;;
  *) sed -n '2,11p' "$0"; exit 1 ;;
esac
