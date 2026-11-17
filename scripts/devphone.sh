#!/usr/bin/env bash
# Development build on a connected iPhone, with its console streamed here.
#
#   scripts/devphone.sh [device-id]      (default: first available iPhone)
#   UI_DRIVER=1 scripts/devphone.sh      with the geisterhand UI driver on :7676
#     (reach it over the CoreDevice tunnel: scripts/phone-ui.sh)
#
# Signs with "Apple Development" + ~/.perry/com_skelpo_cmsadmin_dev.mobileprovision
# (profile "Skelpo CMS Admin Development"; add devices in App Store Connect and
# regenerate it). Replaces the TestFlight install until you reinstall from
# TestFlight. NSLog / stderr output appears in this terminal.
set -euo pipefail
cd "$(dirname "$0")/.."

BUNDLE_ID=com.skelpo.cmsadmin
TEAM=K6UW5YV9F7
PROFILE="$HOME/.perry/com_skelpo_cmsadmin_dev.mobileprovision"
PERRY_WT="${PERRY_WT:-$(cd ../perry/worktrees/ui-ios-fixes/target/release && pwd)}"
export RUSTUP_TOOLCHAIN="${RUSTUP_TOOLCHAIN:-nightly-2026-10-04}"
OUT=build/devphone
APP="$OUT/SkelpoCMS.app"

DEVICE="${1:-$(xcrun devicectl list devices 2>/dev/null | awk '/iPhone/ && /(available|connected)/ {for(i=1;i<=NF;i++) if ($i ~ /^[0-9A-F-]{36}$/) {print $i; exit}}')}"
[[ -n "$DEVICE" ]] || { echo "no available iPhone"; exit 1; }
[[ -f "$PROFILE" ]] || { echo "missing $PROFILE"; exit 1; }
SIGN_ID=$(security find-identity -v -p codesigning | awk -F'"' '/Apple Development: Ralph Kuepper/ {print $2; exit}')

rm -rf "$OUT"; mkdir -p "$OUT"
PERRY_TARGET_CPU=apple-a12 PERRY_RUNTIME_DIR="$PERRY_WT/../aarch64-apple-ios/release" \
  "$PERRY_WT/perry" compile client/main.ts --target ios --app-bundle-id "$BUNDLE_ID" -o "$OUT/SkelpoCMS" \
  ${UI_DRIVER:+--enable-geisterhand} >/dev/null

/usr/libexec/PlistBuddy -c "Delete :NSCameraUsageDescription" -c "Delete :NSMicrophoneUsageDescription" "$APP/Info.plist" 2>/dev/null || true
cp "$PROFILE" "$APP/embedded.mobileprovision"
cat > "$OUT/entitlements.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>application-identifier</key><string>$TEAM.$BUNDLE_ID</string>
  <key>com.apple.developer.team-identifier</key><string>$TEAM</string>
  <key>keychain-access-groups</key><array><string>$TEAM.$BUNDLE_ID</string></array>
  <key>get-task-allow</key><true/>
</dict></plist>
PLIST
codesign --force --sign "$SIGN_ID" --entitlements "$OUT/entitlements.plist" --generate-entitlement-der "$APP"

xcrun devicectl device install app --device "$DEVICE" "$APP" >/dev/null
echo "==> installed; launching with console (Ctrl-C to stop)"
exec xcrun devicectl device process launch --device "$DEVICE" --console --terminate-existing ${LAUNCH_ENV:+--environment-variables "$LAUNCH_ENV"} "$BUNDLE_ID"
