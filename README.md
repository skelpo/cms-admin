# Skelpo CMS Admin

A native app for editing and publishing a [Skelpo CMS](https://www.skelpo.com) website
from a phone. One [Perry](https://github.com/PerryTS/perry) `perry/ui` source tree builds for
iOS, Android, macOS, Linux and Windows. It is a pure client: it signs in to the
CMS that runs behind a website (`https://<site>/api/v1`).

## What it does

| | |
| --- | --- |
| **Home** | Dashboard: website card (visit / share), drafts and items in review, new messages this week, media count, failed background jobs, quick actions, "continue editing" and the latest messages. |
| **Content** | Every content type of the site (pages & posts, collections). Lists by status (live / drafts / in review / archived) and language with thumbnails and search. Create drafts; edit title, slug, all schema fields (text, Markdown, numbers, toggles, single/multi-select chips, images and galleries from the library, JSON for repeaters/relations) and SEO with a live Google preview and length counters; save, publish, unpublish, archive or delete. Unsaved-changes guard. |
| **Media** | Photo grid with search, upload from the photo library (alt text required), alt text per language, copy link / share, delete. Doubles as the image picker for content fields. |
| **Inbox** | Every form's submissions in one feed, grouped by day, filterable by form, with a spam view. Reply by email, copy, mark spam, delete. |
| **More** | Menus, redirects, settings, team (invite, suspend/restore), webhooks (pause/resume, delivery log), background jobs (stats, retry), account (password), multiple signed-in sites, sign out. |

Screens and actions are hidden when the signed-in role lacks the capability.

### Phone and desktop

The same source gives two layouts. On **iOS/Android**: large-title headers,
a 5-tab bar, a bottom action bar on edit screens, pull to refresh, haptics,
native toasts. On **macOS/Windows/Linux**: a sidebar (site switcher,
sections, team/developer pages, account), a toolbar with labelled actions,
two-column Home and editor, a 6-column media grid, hover states and keyboard
shortcuts (⌘S save, ⌘N new item, ⌘R refresh, ⌘[ back, ⌘1–⌘4 sections,
⌘, settings).

## Sign-in model

The user enters the website address (e.g. `www.verrano.de`), email and
password (plus a TOTP code when the account has 2FA). The app checks that
`/api/v1` answers like a Skelpo CMS, logs in, and keeps the session token in
the system keychain, replayed as the `skelpoSession` cookie. Several sites can
be signed in at once. Sessions last 30 days and are rotated near expiry.

## Server requirements

The site's web server must forward `/api/v1/` to the CMS **without caching
authenticated responses** (important behind a CDN). With nginx, for a CMS
on port 3142:

```nginx
location /api/v1/ {
    proxy_pass http://127.0.0.1:3142;
    include /etc/nginx/proxy_params;
    client_max_body_size 32m;
    proxy_hide_header Cache-Control;
    add_header Cache-Control "private, no-store" always;
    add_header X-Robots-Tag "noindex, nofollow" always;
}
```

## Build and run

```bash
make check         # type-check
make run           # macOS app
make sim-install   # iOS simulator
make device        # connected iPhone; first run: perry setup ios --development
```

The app needs a Perry build with UI fixes that are not in a Perry release
yet (network requests in UI apps, iOS photo picker and share sheet, Android
backend; see CLAUDE.md, "Known Perry gaps"). Build Perry from that branch
and point the Makefile at it:

```bash
make PERRY_WT=/path/to/perry/target/release run
```

By default the Makefile and scripts expect the Perry checkout at
`../perry/worktrees/ui-ios-fixes`. `.cargo/config.toml` points the
markdown editor's native crate at the same checkout. Until the fixes ship,
`perry publish` (which builds on Perry Hub) produces an app whose requests
hang.

App Store builds: `make testflight` (needs your own App Store Connect API
key, distribution certificate and profile in `~/.perry`; see
`scripts/testflight.sh`).

## License

MIT, see [LICENSE](LICENSE).

## Layout

```
client/main.ts     shell, navigation and every screen
client/ui.ts       design system (tokens, components)
client/api.ts      /api/v1 client
client/storage.ts  keychain-backed list of signed-in sites
shared/            wire types + error envelope
perry.toml         bundle id, icon, per-platform signing/distribution
assets/icon.png    app icon
```
