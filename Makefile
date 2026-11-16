# Skelpo CMS Admin — build helpers.
#
# One Perry/ui source tree (client/main.ts) → iOS, Android, macOS, Linux,
# Windows. No server here: the app talks to an existing Skelpo CMS over /api/v1.
#
# Builds need a Perry whose macOS/iOS UI pump turns the network loop
# (see "Known Perry gaps" in CLAUDE.md); otherwise every request hangs.

SIM ?= booted
BUNDLE_ID := com.skelpo.cmsadmin

# Pinned to the local Perry worktree that carries the fixes listed in
# CLAUDE.md ("Known Perry gaps"); a stock `perry` on PATH builds an app whose
# requests hang. Override with `make PERRY_WT=/path/to/target/release`.
PERRY_WT ?= $(abspath ../perry/worktrees/ui-ios-fixes/target/release)
PERRY := PERRY_RUNTIME_DIR=$(PERRY_WT) $(PERRY_WT)/perry
# PERRY_RUNTIME_DIR is searched before the per-target dirs, so cross builds
# point it at that target's archives (else the macOS ones get linked).
# iOS code targets apple-a12, the oldest chip iOS 17 runs on. Without it the
# code generator assumes apple-m1 while the assembler defaults to apple-a7 and
# rejects the generated `rcpc` loads.
IOS_CPU := PERRY_TARGET_CPU=apple-a12
PERRY_SIM := $(IOS_CPU) PERRY_RUNTIME_DIR=$(PERRY_WT)/../aarch64-apple-ios-sim/release $(PERRY_WT)/perry
PERRY_DEV := $(IOS_CPU) PERRY_RUNTIME_DIR=$(PERRY_WT)/../aarch64-apple-ios/release $(PERRY_WT)/perry

# macOS dev builds are signed with a real identity so the keychain sees every
# rebuild as the same app (an ad-hoc signature changes per build and makes the
# keychain prompt, which blocks the app). Use MAC_SIGN=- for ad-hoc.
MAC_SIGN ?= Developer ID Application: Skelpo GmbH (K6UW5YV9F7)

.PHONY: all check mac run run-ui sim sim-install device device-build ipa testflight asc-status clean

all: mac

check:
	$(PERRY) check client/main.ts

# macOS app bundle (build/client.app) + bare binary (build/client).
mac:
	mkdir -p build
	$(PERRY) compile client/main.ts -o build/client
	codesign --force --deep --sign "$(MAC_SIGN)" --identifier $(BUNDLE_ID) build/client.app

run: mac
	open build/client.app

# macOS build with the geisterhand UI driver on 127.0.0.1:7676, for scripted
# UI checks (GET /widgets, POST /click/:h, POST /type/:h, GET /screenshot).
run-ui:
	mkdir -p build
	$(PERRY) compile client/main.ts -o build/client-ui --enable-geisterhand
	codesign --force --deep --sign "$(MAC_SIGN)" --identifier $(BUNDLE_ID) build/client-ui.app
	./build/client-ui.app/Contents/MacOS/client-ui

# iOS simulator .app bundle.
sim:
	mkdir -p build
	$(PERRY_SIM) compile client/main.ts --target ios-simulator --app-bundle-id $(BUNDLE_ID) -o build/client-ios

sim-install: sim
	xcrun simctl boot "$(SIM)" 2>/dev/null || true
	open -a Simulator
	xcrun simctl install $(SIM) build/client-ios.app
	xcrun simctl launch $(SIM) $(BUNDLE_ID)

# Physical iPhone/iPad over USB or Wi-Fi. First time per device:
#   perry setup ios --development   (registers the UDID, mints a dev profile)
# --local keeps the build on this machine's Perry (Perry Hub doesn't have the
# UI network-pump fix yet).
device:
	$(PERRY_DEV) run ios --local

# Device binary only (no signing/install) — checks that it compiles and links.
device-build:
	mkdir -p build
	$(PERRY_DEV) compile client/main.ts --target ios --app-bundle-id $(BUNDLE_ID) -o build/client-device

# TestFlight: compile for device, add icon + privacy manifest, sign with the
# App Store profile, validate and upload (scripts/testflight.sh).
# Build number = last uploaded + 1 (scripts/asc.py next-build).
ipa:
	PERRY_WT=$(PERRY_WT) scripts/testflight.sh --no-upload

testflight:
	PERRY_WT=$(PERRY_WT) scripts/testflight.sh

asc-status:
	python3 scripts/asc.py status

clean:
	rm -rf build dist .perry-cache node_modules/.cache/perry
