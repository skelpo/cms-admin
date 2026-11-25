#!/usr/bin/env bash
# Build, sign and upload an iOS build of Skelpo CMS Admin to TestFlight.
#
#   scripts/testflight.sh            next free build number, validate + upload
#   scripts/testflight.sh --no-upload   stop after the signed .ipa (build/release/)
#   BUILD_NUMBER=7 scripts/testflight.sh
#
# Needs (all outside the repo):
#   - the patched Perry (PERRY_WT, see Makefile / CLAUDE.md)
#   - "Apple Distribution: Skelpo GmbH" in the login keychain
#   - ~/.perry/config.toml [apple] API key (key_id, issuer_id, p8_key_path);
#     altool finds the .p8 in ~/.appstoreconnect/private_keys
#   - the App Store profile from `scripts/asc.py setup`
#
# `perry publish ios` would do this on Perry Hub, but the Hub's Perry doesn't
# carry the UI fixes yet (PerryTS/perry#14799), so this packages locally.
set -euo pipefail
cd "$(dirname "$0")/.."

UPLOAD=1
[[ "${1:-}" == "--no-upload" ]] && UPLOAD=0

BUNDLE_ID=com.skelpo.cmsadmin
TEAM=K6UW5YV9F7
SIGN_ID="Apple Distribution: Skelpo GmbH ($TEAM)"
PROFILE="$HOME/.perry/com_skelpo_cmsadmin_appstore.mobileprovision"
PERRY_WT="${PERRY_WT:-$(cd ../perry/worktrees/app-store-fixes/target/release 2>/dev/null && pwd)}"
NAME=SkelpoCMS
OUT=build/release
APP="$OUT/$NAME.app"
PB=/usr/libexec/PlistBuddy
# Native-library crates (@skelpo/markdown-editor) build with Perry's nightly.
export RUSTUP_TOOLCHAIN="${RUSTUP_TOOLCHAIN:-nightly-2026-10-04}"

[[ -x "$PERRY_WT/perry" ]] || { echo "no perry at $PERRY_WT (set PERRY_WT)"; exit 1; }
[[ -f "$PROFILE" ]] || python3 scripts/asc.py setup

VERSION=$(python3 -c 'import tomllib;print(tomllib.load(open("perry.toml","rb"))["project"]["version"])')
if [[ -z "${BUILD_NUMBER:-}" ]]; then
  if [[ $UPLOAD == 1 ]]; then BUILD_NUMBER=$(python3 scripts/asc.py next-build "$VERSION")
  else BUILD_NUMBER=$(python3 scripts/asc.py next-build "$VERSION" 2>/dev/null || echo 1); fi
fi
echo "==> Skelpo CMS $VERSION ($BUILD_NUMBER)"

rm -rf "$OUT"; mkdir -p "$OUT"

echo "==> compile"
PERRY_TARGET_CPU=apple-a12 PERRY_RUNTIME_DIR="$PERRY_WT/../aarch64-apple-ios/release" \
  "$PERRY_WT/perry" compile client/main.ts --target ios --app-bundle-id "$BUNDLE_ID" -o "$OUT/$NAME"

echo "==> app icon (actool)"
XC="$OUT/icon.xcassets/AppIcon.appiconset"
mkdir -p "$XC"
cp assets/icon.png "$XC/icon-1024.png"
cat > "$XC/Contents.json" <<'JSON'
{ "images": [ { "filename": "icon-1024.png", "idiom": "universal", "platform": "ios", "size": "1024x1024" } ],
  "info": { "author": "xcode", "version": 1 } }
JSON
echo '{ "info": { "author": "xcode", "version": 1 } }' > "$OUT/icon.xcassets/Contents.json"
xcrun actool "$OUT/icon.xcassets" --compile "$APP" --platform iphoneos \
  --minimum-deployment-target 17.0 --target-device iphone --target-device ipad \
  --app-icon AppIcon --output-partial-info-plist "$OUT/icon-partial.plist" \
  --errors --warnings >/dev/null

echo "==> Info.plist"
P="$APP/Info.plist"
$PB -c "Delete :CFBundleIcons" -c "Delete :CFBundleIcons~ipad" "$P" 2>/dev/null || true
$PB -c "Merge $OUT/icon-partial.plist" "$P"
$PB -c "Set :CFBundleName 'Skelpo CMS'" "$P"
$PB -c "Set :CFBundleVersion $BUILD_NUMBER" -c "Set :CFBundleShortVersionString $VERSION" "$P"
# Perry's template asks for camera + microphone with another app's wording;
# this app uses neither.
$PB -c "Delete :NSCameraUsageDescription" "$P" 2>/dev/null || true
$PB -c "Delete :NSMicrophoneUsageDescription" "$P" 2>/dev/null || true
$PB -c "Delete :UISupportedInterfaceOrientations" "$P" 2>/dev/null || true
$PB -c "Add :UISupportedInterfaceOrientations array" \
    -c "Add :UISupportedInterfaceOrientations:0 string UIInterfaceOrientationPortrait" "$P"
# iPhone + iPad. iPhone is portrait only; iPad gets every orientation, which
# iPadOS multitasking (Split View, Stage Manager) requires.
$PB -c "Delete :UIDeviceFamily" -c "Add :UIDeviceFamily array" \
    -c "Add :UIDeviceFamily:0 integer 1" -c "Add :UIDeviceFamily:1 integer 2" "$P"
$PB -c "Delete :UISupportedInterfaceOrientations~ipad" "$P" 2>/dev/null || true
$PB -c "Add :UISupportedInterfaceOrientations~ipad array" \
    -c "Add :UISupportedInterfaceOrientations~ipad:0 string UIInterfaceOrientationPortrait" \
    -c "Add :UISupportedInterfaceOrientations~ipad:1 string UIInterfaceOrientationPortraitUpsideDown" \
    -c "Add :UISupportedInterfaceOrientations~ipad:2 string UIInterfaceOrientationLandscapeLeft" \
    -c "Add :UISupportedInterfaceOrientations~ipad:3 string UIInterfaceOrientationLandscapeRight" "$P"
cp assets/ios/PrivacyInfo.xcprivacy "$APP/"
scripts/ios-localize.sh "$APP"
plutil -lint "$P" >/dev/null

echo "==> sign"
cp "$PROFILE" "$APP/embedded.mobileprovision"
cat > "$OUT/entitlements.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>application-identifier</key><string>$TEAM.$BUNDLE_ID</string>
  <key>com.apple.developer.team-identifier</key><string>$TEAM</string>
  <key>keychain-access-groups</key><array><string>$TEAM.$BUNDLE_ID</string></array>
  <key>get-task-allow</key><false/>
  <key>beta-reports-active</key><true/>
</dict></plist>
PLIST
rm -rf "$APP/_CodeSignature"
codesign --force --sign "$SIGN_ID" --entitlements "$OUT/entitlements.plist" --generate-entitlement-der "$APP"
codesign --verify --strict "$APP"

echo "==> ipa"
mkdir -p "$OUT/stage/Payload"
cp -R "$APP" "$OUT/stage/Payload/"
(cd "$OUT/stage" && zip -qry "../$NAME.ipa" Payload)
IPA="$OUT/$NAME.ipa"
ls -lh "$IPA"

[[ $UPLOAD == 1 ]] || exit 0

KEY_ID=$(python3 -c 'import tomllib,os;print(tomllib.load(open(os.path.expanduser("~/.perry/config.toml"),"rb"))["apple"]["key_id"])')
ISSUER=$(python3 -c 'import tomllib,os;print(tomllib.load(open(os.path.expanduser("~/.perry/config.toml"),"rb"))["apple"]["issuer_id"])')
echo "==> validate"
xcrun altool --validate-app -f "$IPA" -t ios --apiKey "$KEY_ID" --apiIssuer "$ISSUER"
echo "==> upload"
xcrun altool --upload-app -f "$IPA" -t ios --apiKey "$KEY_ID" --apiIssuer "$ISSUER"
echo "==> uploaded $VERSION ($BUILD_NUMBER); processing takes ~5-15 min, then it appears in TestFlight"
