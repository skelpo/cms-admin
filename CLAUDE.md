# CLAUDE.md

Notes for Claude Code working in this repo.

## What this is

A native, phone-first **client** for Skelpo CMS, built with Perry's
`perry/ui`. There is **no server here** — `../skelpo-cms` is the backend; the
app talks to it over `/api/v1` on the website's own domain (e.g.
`https://www.verrano.de/api/v1`). Used by the Verrano (`../verrano`) and
skelpo.com (`../skelpo.com/vercel`) sites.

## Stack

- **Compiler:** Perry (local worktree `../perry/worktrees/ui-ios-fixes`,
  the PerryTS/perry#14799 branch). Config: `perry.toml`.
- **Targets:** iOS first; macOS for local testing; Android/Linux/Windows build
  from the same source.

## Layout

```
shared/domain/index.ts   wire types, checked against the CMS route handlers
shared/api/errors.ts     ApiError, the { error: { code, message, details } } envelope, errorMessage()
client/api.ts            fetch client, one fn per /api/v1 endpoint (incl. multipart media upload)
client/storage.ts        keychain: list of signed-in sites (url, email, token, expiry)
client/ui.ts             design system: colour/type tokens (light + dark), cards, grouped
                         lists, pills, buttons, segmented control, chips, inputs, banners,
                         skeletons, empty states, stat tiles
client/main.ts           shell, navigation and every screen
client/i18n.ts           tr()/plural(): UI language (en/de) chosen at launch
client/locales/de.ts     German strings, keyed by the English text
appstore/metadata.json   App Store listing (en-US, de-DE), age rating, review notes
assets/icon.png          1024px app icon (Skelpo S on orange)
```

## UI architecture (main.ts + ui.ts)

- Two shells from one source. `isWide` (= `isDesktop || isPad`) picks the
  layout; `isDesktop` (not iOS/Android) is only for pointer/keyboard/clipboard
  things (hover, "Copy link"); `isPad` adds touch sizes to the wide shell.
  - **Phone (iPhone, Android):** header (large title on tab roots, back bar on pushed screens)
    + notice banner + one `ScrollView` + bottom action bar (editor/forms) +
    5-tab bar (Home / Content / Media / Inbox / More).
  - **Wide (macOS, iPad):** sidebar (240 px; 290 px with 44 pt rows on iPad)
    (site switcher, sections, user) | main column with a toolbar header
    (back + breadcrumb + title + labelled action buttons). Screen actions go
    into the toolbar, not a bottom bar. Wider grids, inline Markdown editor
    (no Write screen); two-column Home and editor on desktop only (iPad
    stacks them: no window-size API, and Split View can be narrow). Desktop adds hover
    states and ⌘S/⌘N/⌘R/⌘[/⌘1–4/⌘,.
- Each navigation calls `render()`, which `widgetClearChildren(content)` and
  rebuilds the screen imperatively. Back restores the scroll offset.
- Success messages use the native toast (`showToast`) + haptics; errors and
  progress use the inline banner under the header.
- Palette is chosen once at launch from `isDarkMode()` (dynamic colours are
  macOS-only in perry/ui).
- Centring: two flexible `Spacer`s around a view are ambiguous to both
  NSStackView and UIStackView. Use `centerBox` (centre-aligned VStack + computed
  top inset) in ui.ts. A shadow turns off clipping, so rounded gradients/images
  get their shadow from a wrapper (`shadowed`).
- `textSetFontWeight` takes Apple's -1…1 weight, not CSS 400–800; `text()` in
  ui.ts maps CSS-style weights.
- No `state()` / `NavStack` / `ForEach`. Those are compile-time rewrites that
  only track narrow shapes; imperative clear + rebuild works on every backend.
- `navStack: string[]` of `R_*` route names; module-level caches per screen so
  Back redraws without refetching. `renderSeq` guards async loaders: a loader
  drops its result if the user navigated away.
- Layout rule: `column()` = VStack with leading alignment; use `add()` (adds +
  `widgetMatchParentWidth`) for anything that must span the width. Stack
  alignment 7 ("width") does not work on macOS.
- Capabilities from `/auth/me` gate screens/actions (`can()`, `canType()`).

## Languages (English + German)

- Every user-facing string is `tr("English text", { param })` or
  `plural(n, "{n} item", "{n} items")` from `client/i18n.ts`; the English text
  is the key and `client/locales/de.ts` holds the German. Informal "du".
  `make i18n` (also run by `make check`) fails on missing/unused keys or
  mismatched `{placeholders}` — keys must be literals for it to see them.
- CMS-provided text (type labels, field labels, form names, server error
  messages) is shown as-is; `noun()` keeps German nouns capitalised mid-sentence.
- Language = `getLocale()` at launch, overridable with the `SKELPO_LANG` user
  default. iOS only reports German if the bundle declares it:
  `scripts/ios-localize.sh` adds CFBundleLocalizations + en/de.lproj (run by
  `make sim` and testflight.sh). That also lists both languages on the App
  Store and gives the app a per-app language switch in iOS Settings.

## CMS contract gotchas (verified against ../skelpo-cms code)

- **Auth = session token replayed as `Cookie: skelpoSession=<token>`.** Bearer
  is only for `skp_v1_` API tokens. No CSRF/Origin check on /api/v1.
- **No trailing slashes**: `/content` works, `/content/` is a 404.
- `GET /content` without `status` returns **published only**, even for admins.
  The keyset cursor pages on `publishedAt`, so list one status at a time.
- `PATCH /content/:id` replaces the whole `fields` object — always send every key.
- Publish needs `seo.metaDescription` 70–160 chars and title ≤ 70; reasons are
  in `details.errors[]` (shown by `errorMessage()`).
- Forms are content rows of type `form`; there is no forms list endpoint.
- `/auth/refresh` leaves the old session alive, so the client logs it out.
  The app refreshes only within 7 days of the 30-day expiry.
- Changing a password deletes all of that user's sessions (incl. this one).
- Media upload is multipart only (`file`, `altText` JSON; alt text required for
  images; 25 MB cap). `GET /media/:id/raw` is public. No media paging (max 200).
- Job stats are a map keyed `pending/running/done/failed/dead`; zero counts are
  absent. Only `failed`/`dead` jobs can be retried.

## Known Perry gaps

Upstream PR with the UI/codegen fixes below: https://github.com/PerryTS/perry/pull/14799
(fetch hang, iOS stack alignment, Image lowering, image cache, alerts,
TextArea, notification prompt, matchParentWidth, device-build CPU). Not in
it: the iOS shape-table capacity change, which only patches an uncommitted
local change in the worktree, and the simulator keychain entitlement.

- **UI apps never turned the network loop (fixed locally, not upstream yet).**
  Since the tokio removal, `fetch` completes on turnloop NET completions that
  only a loop turn collects. CLI programs turn it in `js_wait_for_event`; the
  macOS/iOS `perry/ui` pump didn't, so every `await fetch()` hung (the request
  was never even written). Patch in the Perry worktree: new
  `js_loop_settle_once()` in `perry-runtime/src/event_pump.rs`, called from the
  pump in `perry-ui-macos/src/app.rs` and `perry-ui-ios/src/app.rs`. Until it
  ships upstream, build locally (`perry run ios --local`); `perry publish`
  builds on Perry Hub and would produce an app whose requests hang.
- macOS `widgetMatchParentWidth` ignored the parent's padding (also patched
  locally in `perry-ui-macos/src/widgets/mod.rs`; iOS was already correct).
- Positional `Image(url)` / `Image(url, alt)` had no codegen lowering and
  returned handle 1 (the program's first widget), so adding it to a container
  re-parented that widget. Patched locally in
  `perry-codegen/src/lower_call/native/native_ui_appshell_branch.rs`.
- iOS `stackSetAlignment` passed the documented constants (NSLayoutAttribute:
  5 leading, 9 centerX, 10 centerY…) straight to `UIStackView`, which throws
  for anything above 5 → crash at launch. Patched locally in
  `perry-ui-ios/src/ffi/widgets_basic.rs` (translation table). Note the
  Perry docs list 12 as "CenterY"; 12 is actually firstBaseline — use 10.
- After rebuilding runtime archives in the worktree, regenerate the GC
  sidecars: `scripts/gc_call_effects/sidecars.sh target/<triple>/release`,
  or every compile fails with "GC effects sidecar cannot speak for…".
- Fetch **does** send binary and `FormData` bodies (verified), so media upload
  works natively.
- iOS `Image(url)` refetched and full-size-decoded every image on the main
  thread on every redraw. Patched locally in `perry-ui-ios/src/widgets/image.rs`:
  NSCache by URL + background decode downscaled to 1400 px.
- iOS `imagePickerPick` and `shareUrl`/`shareText` were stubs (picker
  returned `[]`, share only logged). Implemented locally:
  `perry-ui-ios/src/image_picker.rs` (PHPickerViewController, PhotosUI loaded
  with dlopen because the compiler doesn't link it; HEIC etc. arrive as JPEG
  copies in tmp/perry-picks) and `perry-ui-ios/src/share.rs`
  (UIActivityViewController, popover-anchored on iPad).
- iOS `alertWithButtons` now styles "Cancel" as cancel and Delete/Remove/
  Discard/Archive/Sign out/Suspend as destructive (`perry-ui-ios/src/widgets/alert.rs`).
- `TextArea` used Menlo + a bezel on macOS and 14 pt on iOS; patched to the
  system font with inner padding and no border (`*/widgets/textarea.rs`).
- iOS asked for notification permission at launch in every perry/ui app;
  patched to ask on first notification use (`perry-ui-ios/src/notifications.rs`,
  `app.rs`). Unexplained permission prompts get flagged in App Review.
- **iOS shape table**: an uncommitted 2026-11-09 patch in the worktree capped
  the shape Region at 1 << 22 rows on iOS (`perry-runtime/src/object/
  shapes_store/flat.rs`). The app then aborted with "Perry ShapeId space
  exhausted" at the first runtime RegExp object. Raised to 1 << 24 (reserved
  address space, committed lazily). Rebuild BOTH `perry-runtime-static` and
  `perry-stdlib-static` for the iOS triples after runtime changes: the stdlib
  archive carries its own copy of the runtime.
- iOS static archives come from the `perry-runtime-static` /
  `perry-stdlib-static` crates (`perry-stdlib` alone only emits an rlib).
- `PERRY_RUNTIME_DIR` is searched before the per-target dirs, so iOS builds
  set it to `target/aarch64-apple-ios{,-sim}/release` (else the macOS
  archives get linked). iOS builds also set `PERRY_TARGET_CPU=apple-a12`: the
  code generator assumes apple-m1 while the assembler defaults to apple-a7 and
  rejects `rcpc` loads.
- `process.env` aborted the runtime on iOS with a large environment; the app
  reads its simulator dev hooks from user defaults instead (see `devEnv`).
- iOS root views are laid out inside the safe area, so the app adds no
  status-bar/home-indicator padding of its own on iOS.
- Simulator builds have no keychain entitlement (Perry doesn't embed the
  simulator `__entitlements` section), so sign-ins don't persist across
  launches in the simulator. Device builds get it from the provisioning profile.
- Rich-text fields use `@skelpo/markdown-editor` (npm; source in
  `../skelpo-markdown-editor`, github.com/skelpo/markdown-editor; releases
  by `v<version>` tag → release.yml with npm Trusted Publisher): a native UITextView/NSTextView with live Markdown
  styling. Phone: the field is a preview card that opens the full-screen
  Write screen (`R_WRITE`, drawn in `writePane` instead of the shared
  ScrollView). Desktop: inline editor under a formatting bar. One editor per
  field of the open item (`mdEditors`), kept across redraws. Image toolbar
  button → media picker (`pickMarkdown`) → inserts `![alt](/api/v1/media/<id>/raw)`.
  Its Rust crate is built by Perry with cargo from this directory:
  `RUSTUP_TOOLCHAIN=nightly-2026-10-04` (set in the Makefile and
  testflight.sh) and `.cargo/config.toml` points perry-ffi at the local Perry
  worktree. The package must be in `package.json` `perry.allow.nativeLibrary`.
- iOS tap gestures crashed in UIKit (`-[UIGestureRecognizer _delayTouch:forEvent:]`
  inserting nil) when an async re-render removed the touched view mid-touch.
  Root cause (found on device): perry/ui builds the shell before
  UIApplicationMain, so recognizers added then (the main ScrollView's) never
  got a `_delayedEventComponentDispatcher`. Fixed in
  `perry-ui-ios/src/touch_guard.rs` (`reregister_early_recognizers`, called
  after the window is shown); build 0.2.0 (4).
- Debugging on the phone: `scripts/devphone.sh` installs a development build
  (profile ~/.perry/com_skelpo_cmsadmin_dev.mobileprovision) and streams its
  console; `UI_DRIVER=1` adds the geisterhand driver, and `scripts/phone-ui.sh`
  drives it over Wi-Fi (widgets / click / type / screenshot). Careful: the
  phone is signed in to the live sites — the last tappable on the item editor
  is "Save changes".
- The Makefile pins `PERRY_WT` to the patched worktree: `~/.local/bin/perry`
  may point at another worktree without these fixes. macOS dev builds are
  signed with the Developer ID (`MAC_SIGN`) so the keychain doesn't prompt
  (an ad-hoc signature changes per build and the prompt blocks the app).

## Common commands

```bash
perry check client/main.ts     # type-check
make run                       # macOS app
make run-ui                    # macOS + geisterhand UI driver on :7676
make sim-install               # iOS simulator
make device                    # connected iPhone (perry setup ios --development first)
make testflight                # build, sign, validate, upload to TestFlight (build no. = last + 1)
make ipa                       # same, stop at build/release/SkelpoCMS.ipa
make asc-status                # bundle ID, App Store profile, app record, recent builds
make i18n                      # German strings vs. tr() keys
scripts/screenshots.sh         # App Store screenshots, en + de
python3 scripts/asc.py metadata    # push appstore/metadata.json
```

Simulator automation (no UI driver on iOS): set user defaults, then launch —
`xcrun simctl spawn booted defaults write com.skelpo.cmsadmin SKELPO_DEV_URL
http://127.0.0.1:3137` (+ `_EMAIL`, `_PASSWORD`, `_TAB` 0–4, `_TYPE` slug,
`_EDIT` 1, `_WRITE` body), and `xcrun simctl io booted screenshot x.png`.

App Store screenshots: `scripts/screenshots.sh` (en-US + de-DE, 6.9" "Shots
iPhone 6.9" simulator, status bar 9:41; `DEVICE="Shots iPad 13"` for the
13" iPad set) → `appstore/screenshots/`, then
`python3 scripts/asc.py screenshots appstore/screenshots`.

Local CMS for testing: the Verrano CMS on http://127.0.0.1:3137 (see
`../verrano/CLAUDE.md` for credentials). On a phone the server must be https.

## TestFlight / App Store

- App Store Connect app "Skelpo CMS" (id 6835516180), bundle ID
  `com.skelpo.cmsadmin`, team K6UW5YV9F7. API key + profile live in
  `~/.perry/` (`scripts/asc.py` reads `~/.perry/config.toml [apple]`).
- `scripts/testflight.sh` packages locally because Perry Hub's Perry lacks
  #14799. It post-processes Perry's bundle: actool icon (Assets.car), privacy
  manifest (`assets/ios/PrivacyInfo.xcprivacy`), CFBundleName, build number,
  drops Perry's template camera/mic usage strings (another app's wording),
  iPhone + iPad (UIDeviceFamily 1, 2; iPad support can never be removed
  from a shipped app), iPhone portrait / iPad all four orientations (iPadOS
  multitasking needs them), en/de localizations, then signs with Apple Distribution + the App Store
  profile and uploads with `altool --apiKey`.
- Listing text, categories, age rating, copyright and review notes:
  `appstore/metadata.json` → `python3 scripts/asc.py metadata`. Not settable by
  API (do it in the web UI): App Privacy ("Data Not Collected"), price and
  availability, review contact and the demo account. The review-notes PATCH
  fails (409) until the review contact is filled in.
- Demo account for App Review: https://demo.skelpo.com, its own Skelpo CMS
  instance on webserver.skelpo.net (see appstore/demo/README.md for the
  setup and how to reset its content).
- The Perry compiler must link LLVM 22 (`LLVM_SYS_221_PREFIX=/opt/homebrew/opt/llvm@22`);
  Homebrew's `llvm` is 23, which rejects Perry's iOS `Os` level.
- The Makefile now points at the `ui-ios-fixes` worktree (the #14799 branch);
  macOS, aarch64-apple-ios and aarch64-apple-ios-sim archives are built there.

## Adding an endpoint

1. Check the handler in `../skelpo-cms/src/routes/api/` (not docs/api-spec.md,
   which is stale) and add/adjust the type in `shared/domain/index.ts`.
2. Add a function in `client/api.ts` (`reqData` for `{data}`, `request` for 204).
3. Add an `R_*` route, a `screenX(seq, reload)` function and a `render()` branch.
