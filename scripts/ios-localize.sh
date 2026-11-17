#!/usr/bin/env bash
# Declare the app's UI languages (English, German) in an iOS .app bundle.
#
#   scripts/ios-localize.sh build/release/SkelpoCMS.app
#
# Perry's bundle has no localizations, so iOS would report English to
# getLocale() even on a German device, and App Store Connect would list the
# app as English-only. This adds CFBundleLocalizations and an en.lproj /
# de.lproj with InfoPlist.strings. The UI strings themselves are compiled into
# the binary (client/i18n.ts, client/locales/de.ts). With two localizations,
# iOS Settings also shows a per-app "Language" switch.
set -euo pipefail
APP="${1:?usage: ios-localize.sh <path/to/App.app>}"
P="$APP/Info.plist"
PB=/usr/libexec/PlistBuddy

$PB -c "Delete :CFBundleLocalizations" "$P" 2>/dev/null || true
$PB -c "Add :CFBundleLocalizations array" \
    -c "Add :CFBundleLocalizations:0 string en" \
    -c "Add :CFBundleLocalizations:1 string de" "$P"
$PB -c "Delete :CFBundleDevelopmentRegion" "$P" 2>/dev/null || true
$PB -c "Add :CFBundleDevelopmentRegion string en" "$P"

for lang in en de; do
  mkdir -p "$APP/$lang.lproj"
  printf '"CFBundleDisplayName" = "Skelpo CMS";\n"CFBundleName" = "Skelpo CMS";\n' > "$APP/$lang.lproj/InfoPlist.strings"
  plutil -convert binary1 "$APP/$lang.lproj/InfoPlist.strings"
done
