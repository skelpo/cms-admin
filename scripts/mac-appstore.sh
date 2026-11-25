#!/usr/bin/env bash
# Build, sign and upload a macOS build of Skelpo CMS Admin to the Mac App Store.
#
#   scripts/mac-appstore.sh               next free build number, validate + upload
#   scripts/mac-appstore.sh --no-upload   stop after the signed .pkg (build/mac-release/)
#   scripts/mac-appstore.sh --sandbox-test  Developer ID + sandbox, no profile: a build
#                                         you can launch locally to check the sandbox
#   BUILD_NUMBER=7 scripts/mac-appstore.sh
#
# Needs (all outside the repo):
#   - Perry with the UI fixes (PERRY_WT, see Makefile / README)
#   - "3rd Party Mac Developer Application/Installer: Skelpo GmbH" in the keychain
#   - ~/.perry/config.toml [apple] API key; altool finds the .p8 in
#     ~/.appstoreconnect/private_keys
#   - the Mac App Store profile from `scripts/asc.py setup-mac`
set -euo pipefail
cd "$(dirname "$0")/.."

MODE=upload
case "${1:-}" in --no-upload) MODE=pkg ;; --sandbox-test) MODE=sandbox ;; esac

BUNDLE_ID=com.skelpo.cmsadmin
TEAM=K6UW5YV9F7
APP_ID="3rd Party Mac Developer Application: Skelpo GmbH ($TEAM)"
INSTALLER_ID="3rd Party Mac Developer Installer: Skelpo GmbH ($TEAM)"
DEVID="Developer ID Application: Skelpo GmbH ($TEAM)"
PROFILE="$HOME/.perry/com_skelpo_cmsadmin_macos.provisionprofile"
PERRY_WT="${PERRY_WT:-$(cd ../perry/worktrees/app-store-fixes/target/release 2>/dev/null && pwd)}"
NAME=SkelpoCMS
OUT=build/mac-release
APP="$OUT/$NAME.app"
MIN_OS=13.0
PB=/usr/libexec/PlistBuddy
export RUSTUP_TOOLCHAIN="${RUSTUP_TOOLCHAIN:-nightly-2026-10-04}"
# The linker stamps this into the binary; without it, it's the build Mac's macOS.
export MACOSX_DEPLOYMENT_TARGET=$MIN_OS

[[ -x "$PERRY_WT/perry" ]] || { echo "no perry at $PERRY_WT (set PERRY_WT)"; exit 1; }
[[ $MODE == sandbox || -f "$PROFILE" ]] || python3 scripts/asc.py setup-mac

VERSION=$(python3 -c 'import tomllib;print(tomllib.load(open("perry.toml","rb"))["project"]["version"])')
if [[ -z "${BUILD_NUMBER:-}" ]]; then
  if [[ $MODE == upload ]]; then BUILD_NUMBER=$(ASC_PLATFORM=MAC_OS python3 scripts/asc.py next-build "$VERSION")
  else BUILD_NUMBER=$(python3 scripts/asc.py next-build "$VERSION" 2>/dev/null || echo 1); fi
fi
echo "==> Skelpo CMS for Mac $VERSION ($BUILD_NUMBER)"

rm -rf "$OUT"; mkdir -p "$OUT"

echo "==> compile"
PERRY_RUNTIME_DIR="$PERRY_WT" "$PERRY_WT/perry" compile client/main.ts -o "$OUT/$NAME"
[[ -d "$APP" ]] || { echo "expected $APP"; exit 1; }
EXE="$APP/Contents/MacOS/$($PB -c 'Print :CFBundleExecutable' "$APP/Contents/Info.plist")"
vtool -show-build "$EXE" | grep -q "minos $MIN_OS" || { echo "binary minos is not $MIN_OS:"; vtool -show-build "$EXE"; exit 1; }

echo "==> app icon (actool)"
XC="$OUT/icon.xcassets/AppIcon.appiconset"
mkdir -p "$XC"
IMAGES=""
for pt in 16 32 128 256 512; do
  for sc in 1 2; do
    f="icon_${pt}x${pt}@${sc}x.png"
    sips -z $((pt * sc)) $((pt * sc)) assets/icon.png --out "$XC/$f" >/dev/null
    IMAGES="$IMAGES{\"filename\":\"$f\",\"idiom\":\"mac\",\"scale\":\"${sc}x\",\"size\":\"${pt}x${pt}\"},"
  done
done
echo "{\"images\":[${IMAGES%,}],\"info\":{\"author\":\"xcode\",\"version\":1}}" > "$XC/Contents.json"
echo '{ "info": { "author": "xcode", "version": 1 } }' > "$OUT/icon.xcassets/Contents.json"
xcrun actool "$OUT/icon.xcassets" --compile "$APP/Contents/Resources" --platform macosx \
  --minimum-deployment-target $MIN_OS --target-device mac \
  --app-icon AppIcon --output-partial-info-plist "$OUT/icon-partial.plist" \
  --errors --warnings >/dev/null

echo "==> Info.plist"
P="$APP/Contents/Info.plist"
$PB -c "Merge $OUT/icon-partial.plist" "$P"
for k in NSCameraUsageDescription NSMicrophoneUsageDescription CFBundleName CFBundleDisplayName \
         LSApplicationCategoryType LSMinimumSystemVersion ITSAppUsesNonExemptEncryption \
         CFBundleSupportedPlatforms CFBundleLocalizations CFBundleDevelopmentRegion; do
  $PB -c "Delete :$k" "$P" 2>/dev/null || true
done
$PB -c "Add :CFBundleName string 'Skelpo CMS'" -c "Add :CFBundleDisplayName string 'Skelpo CMS'" \
    -c "Set :CFBundleVersion $BUILD_NUMBER" -c "Set :CFBundleShortVersionString $VERSION" \
    -c "Add :LSApplicationCategoryType string public.app-category.productivity" \
    -c "Add :LSMinimumSystemVersion string $MIN_OS" \
    -c "Add :ITSAppUsesNonExemptEncryption bool false" \
    -c "Add :CFBundleSupportedPlatforms array" -c "Add :CFBundleSupportedPlatforms:0 string MacOSX" \
    -c "Add :CFBundleLocalizations array" -c "Add :CFBundleLocalizations:0 string en" \
    -c "Add :CFBundleLocalizations:1 string de" -c "Add :CFBundleDevelopmentRegion string en" "$P"
for lang in en de; do
  mkdir -p "$APP/Contents/Resources/$lang.lproj"
  printf '"CFBundleDisplayName" = "Skelpo CMS";\n"CFBundleName" = "Skelpo CMS";\n' > "$APP/Contents/Resources/$lang.lproj/InfoPlist.strings"
  plutil -convert binary1 "$APP/Contents/Resources/$lang.lproj/InfoPlist.strings"
done
cp assets/ios/PrivacyInfo.xcprivacy "$APP/Contents/Resources/"
plutil -lint "$P" >/dev/null

echo "==> sign"
# Sandbox: outgoing network (the CMS), photos/files the user picks in the open panel.
cat > "$OUT/entitlements.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>com.apple.security.app-sandbox</key><true/>
  <key>com.apple.security.network.client</key><true/>
  <key>com.apple.security.files.user-selected.read-only</key><true/>
$( [[ $MODE == sandbox ]] || echo "  <key>com.apple.application-identifier</key><string>$TEAM.$BUNDLE_ID</string>
  <key>com.apple.developer.team-identifier</key><string>$TEAM</string>" )
</dict></plist>
PLIST
xattr -cr "$APP"
rm -rf "$APP/Contents/_CodeSignature"
if [[ $MODE == sandbox ]]; then
  codesign --force --options runtime --sign "$DEVID" --entitlements "$OUT/entitlements.plist" "$APP"
  codesign --verify --strict --deep "$APP"
  echo "==> sandboxed test build: open $APP"
  exit 0
fi
cp "$PROFILE" "$APP/Contents/embedded.provisionprofile"
codesign --force --options runtime --sign "$APP_ID" --entitlements "$OUT/entitlements.plist" "$APP"
codesign --verify --strict --deep "$APP"

echo "==> pkg"
PKG="$OUT/$NAME.pkg"
productbuild --component "$APP" /Applications --sign "$INSTALLER_ID" "$PKG"
ls -lh "$PKG"

[[ $MODE == upload ]] || exit 0

KEY_ID=$(python3 -c 'import tomllib,os;print(tomllib.load(open(os.path.expanduser("~/.perry/config.toml"),"rb"))["apple"]["key_id"])')
ISSUER=$(python3 -c 'import tomllib,os;print(tomllib.load(open(os.path.expanduser("~/.perry/config.toml"),"rb"))["apple"]["issuer_id"])')
echo "==> validate"
xcrun altool --validate-app -f "$PKG" -t macos --apiKey "$KEY_ID" --apiIssuer "$ISSUER"
echo "==> upload"
xcrun altool --upload-app -f "$PKG" -t macos --apiKey "$KEY_ID" --apiIssuer "$ISSUER"
echo "==> uploaded $VERSION ($BUILD_NUMBER); processing takes ~5-15 min"
