# CLAUDE.md

Notes for Claude Code working in this repo.

## What this is

A native, phone-first **client** for Skelpo CMS, built with Perry's
`perry/ui`. There is **no server here** — `../skelpo-cms` is the backend; the
app talks to it over `/api/v1` on the website's own domain (e.g.
`https://www.verrano.de/api/v1`). Used by the Verrano (`../verrano`) and
skelpo.com (`../skelpo.com/vercel`) sites.

## Stack

- **Compiler:** Perry (local worktree `../perry/worktrees/perry-latest`,
  0.5.1664 + the UI pump patch below). Config: `perry.toml`.
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
assets/icon.png          1024px app icon (Skelpo S on orange)
```

## UI architecture (main.ts + ui.ts)

- Two shells from one source (`isDesktop` = not iOS/Android):
  - **Phone:** header (large title on tab roots, back bar on pushed screens)
    + notice banner + one `ScrollView` + bottom action bar (editor/forms) +
    5-tab bar (Home / Content / Media / Inbox / More).
  - **Desktop:** 240 px sidebar (site switcher, sections, user) | main column
    with a toolbar header (back + breadcrumb + title + labelled action
    buttons). Screen actions go into the toolbar, not a bottom bar. Wider
    grids, two-column Home and editor, hover states, ⌘S/⌘N/⌘R/⌘[/⌘1–4/⌘,.
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
- `@honeide/editor` is not integrated; rich text fields are edited as Markdown
  in a TextArea.
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
```

Simulator automation (no UI driver on iOS): set user defaults, then launch —
`xcrun simctl spawn booted defaults write com.skelpo.cmsadmin SKELPO_DEV_URL
http://127.0.0.1:3137` (+ `_EMAIL`, `_PASSWORD`, `_TAB` 0–4, `_TYPE` slug,
`_EDIT` 1), and `xcrun simctl io booted screenshot x.png`.

Local CMS for testing: the Verrano CMS on http://127.0.0.1:3137 (see
`../verrano/CLAUDE.md` for credentials). On a phone the server must be https.

## Adding an endpoint

1. Check the handler in `../skelpo-cms/src/routes/api/` (not docs/api-spec.md,
   which is stale) and add/adjust the type in `shared/domain/index.ts`.
2. Add a function in `client/api.ts` (`reqData` for `{data}`, `request` for 204).
3. Add an `R_*` route, a `screenX(seq, reload)` function and a `render()` branch.
