// Skelpo CMS Admin — native client for a Skelpo CMS backend.
//
// One `perry/ui` source tree for iOS, Android, macOS, Linux and Windows. It is
// a pure client: every screen talks to an existing CMS over `/api/v1`
// (see ./api.ts). The look comes from the design system in ./ui.ts.
//
// The UI is imperative: a header, one ScrollView whose content is cleared and
// rebuilt on every navigation, an optional bottom action bar and a tab bar.
// There is no `state()` / `NavStack` / `ForEach` — those compile-time rewrites
// only track a narrow set of shapes, while `widgetClearChildren` +
// `widgetAddChild` behave the same on every backend. Screens draw from
// module-level caches, so going Back never refetches, and Back restores the
// scroll position.
import {
  App,
  HStack,
  addKeyboardShortcut,
  Image,
  ImageFile,
  ProgressView,
  ScrollView,
  Spacer,
  Toggle,
  VStack,
  alertWithButtons,
  clipboardWrite,
  scrollviewEndRefreshing,
  scrollviewGetOffset,
  scrollviewSetChild,
  scrollviewSetOffset,
  scrollviewSetRefreshControl,
  setCornerRadius,
  setPadding,
  showToast,
  stackSetAlignment,
  stackSetDetachesHidden,
  stackSetDistribution,
  textSetString,
  textSetTextAlignment,
  toggleSetState,
  widgetAddChild,
  widgetClearChildren,
  widgetMatchParentWidth,
  widgetMatchParentHeight,
  widgetSetBackgroundGradient,
  widgetSetHeight,
  widgetSetHidden,
  widgetSetHugging,
  widgetSetOnClick,
  widgetSetWidth,
} from "perry/ui";
import type { Widget } from "perry/ui";
import { getAppVersion, getSafeAreaInsets, imagePickerPick, openURL, preferencesGet, shareUrl } from "perry/system";
import {
  Format,
  destroyEditor,
  focusEditor,
  getMarkdown,
  insertMarkdown,
  markdownEditor,
  runFormat,
  setPreview,
  wordCount,
} from "@skelpo/markdown-editor";
import type { MarkdownEditor } from "@skelpo/markdown-editor";
import * as api from "./api.js";
import * as store from "./storage.js";
import { decimal, isGerman, noun, plural, tr } from "./i18n.js";
import { ApiError, errorMessage } from "../shared/api/errors.js";
import type {
  ContentItem,
  ContentType,
  FieldDef,
  FormSubmission,
  JobSummary,
  MediaItem,
  MenuItem,
  MenuSummary,
  MeResult,
  Redirect,
  Role,
  UserListItem,
  Webhook,
  WebhookDelivery,
} from "../shared/domain/index.js";
import {
  B_DANGER,
  B_GHOST_ON_BRAND,
  B_ON_BRAND,
  B_PRIMARY,
  B_SECONDARY,
  B_TINTED,
  BG,
  BODY,
  BRAND,
  BRAND_DEEP,
  BRAND_INK,
  BRAND_TINT,
  DANGER,
  FAINT,
  HAIRLINE,
  INK,
  K_BRAND,
  K_DANGER,
  K_INFO,
  K_NEUTRAL,
  K_OK,
  K_WARN,
  MUTED,
  OK_FG,
  PAD,
  SURFACE,
  SURFACE2,
  SURFACE3,
  TILE_BLUE,
  TILE_GRAY,
  TILE_GREEN,
  TILE_INDIGO,
  TILE_ORANGE,
  TILE_PINK,
  TILE_PURPLE,
  TILE_RED,
  TILE_TEAL,
  TILE_YELLOW,
  WARN_FG,
  WHITE,
  actionItem,
  add,
  avatar,
  banner,
  bg,
  bodyText,
  boxed,
  button,
  buttonRow,
  caption,
  card,
  centerColumn,
  chipButton,
  chips,
  color,
  column,
  counter,
  dark,
  divider,
  emptyState,
  field,
  fixed,
  footnote,
  gap,
  group,
  groupLabel,
  grow,
  haptic,
  heroCard,
  hrow,
  iconButton,
  iconTile,
  infoItem,
  input,
  isIOS,
  isAndroid,
  isDesktop,
  isPad,
  isWide,
  hoverTint,
  centeredLabel,
  isMobile,
  item,
  largeTitle,
  loadingBlock,
  logoMark,
  logoMarkWhite,
  onTap,
  pill,
  put,
  searchField,
  sectionHeader,
  segmented,
  setCounter,
  skeletonList,
  softTile,
  statTile,
  symbol,
  tag,
  text,
  textArea,
  tintFill,
  title2,
  toolButton,
} from "./ui.js";
import type { Rgba } from "./ui.js";

// Development hooks for driving the simulator from the command line, read
// from user defaults (`xcrun simctl spawn booted defaults write
// com.skelpo.cmsadmin SKELPO_DEV_URL http://…`). Never set in production.
// SKELPO_DEV_URL/_EMAIL/_PASSWORD sign in; _TAB opens a tab (0–4); _TYPE
// opens a content type by slug; _EDIT=1 then opens its first item; _HOST
// shows a local server under a public name (screenshots); _ACTION=upload|share
// opens the photo picker or share sheet.
// (Not process.env: building that object aborts the Perry runtime on iOS
// when the environment is large.)
function devEnv(key: string): string {
  if (!isMobile) return "";
  const v = preferencesGet(key);
  return typeof v === "string" ? v : "";
}
/** Horizontal page margin. */
const GUTTER = isWide ? 32 : PAD;
/** Height of primary action buttons (bottom bar on phones, toolbar on desktop). */
const AB_H = isDesktop ? 34 : isPad ? 44 : 50;

// ---------- formatting helpers ------------------------------------------

const MONTHS = isGerman
  ? ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."]
  : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDate(iso: string | null): string {
  if (!iso || iso.length < 10) return "";
  return iso.slice(0, 10);
}
function parseTime(iso: string | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return t > 0 ? t : 0;
}
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
/** "12 Mar" / "12. März", with the year when it isn't this one. */
function dayMonth(t: number): string {
  const d = new Date(t);
  const now = new Date();
  const y = d.getFullYear() === now.getFullYear() ? "" : ` ${d.getFullYear()}`;
  return `${d.getDate()}${isGerman ? "." : ""} ${MONTHS[d.getMonth()] ?? ""}${y}`;
}
/** "Just now", "5 min ago", "3 h ago", "Yesterday", "4 days ago", "12 Mar". */
function relTime(iso: string | null): string {
  const t = parseTime(iso);
  if (t === 0) return shortDate(iso);
  const s = (Date.now() - t) / 1000;
  if (s < 60) return tr("Just now");
  if (s < 3600) return tr("{n} min ago", { n: Math.floor(s / 60) });
  if (s < 86400) return tr("{n} h ago", { n: Math.floor(s / 3600) });
  if (s < 172800) return tr("Yesterday");
  if (s < 7 * 86400) return tr("{n} days ago", { n: Math.floor(s / 86400) });
  return dayMonth(t);
}
/** relTime for use mid-sentence ("Edited yesterday"). */
function relTimeInline(iso: string | null): string {
  const s = relTime(iso);
  return s.length > 0 ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}
/** Inbox-style stamp: "14:05" today, "Yesterday", weekday name, or date. */
function inboxTime(iso: string | null): string {
  const t = parseTime(iso);
  if (t === 0) return shortDate(iso);
  const d = new Date(t);
  const bucket = dayBucket(iso);
  if (bucket === 0) return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if (bucket === 1) return tr("Yesterday");
  return dayMonth(t);
}
function fullTime(iso: string | null): string {
  const t = parseTime(iso);
  if (t === 0) return shortDate(iso);
  const d = new Date(t);
  return `${dayMonth(t)}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
/** 0 today, 1 yesterday, 2 this week, 3 earlier. */
function dayBucket(iso: string | null): number {
  const t = parseTime(iso);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (t >= start) return 0;
  if (t >= start - 86400000) return 1;
  if (t >= start - 6 * 86400000) return 2;
  return 3;
}
const BUCKET_LABELS = [tr("Today"), tr("Yesterday"), tr("This week"), tr("Earlier")];

function baseName(p: string): string {
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(i + 1) : p;
}
/** Simulator dev hook: a local server shown under a public name (App Store screenshots). */
const devHost = devEnv("SKELPO_DEV_HOST");
function hostOf(url: string): string {
  const h = url.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  return devHost.length > 0 && /^(127\.0\.0\.1|localhost)(:|$)/.test(h) ? devHost : h;
}
/** "www.verrano.de" → "verrano.de" for titles. */
function siteName(url: string): string {
  return hostOf(url).replace(/^www\./i, "");
}
function plausibleDims(m: MediaItem): string {
  if (!m.width || !m.height || m.width > 16000 || m.height > 16000) return "";
  return `${m.width} × ${m.height}`;
}
function fileSize(bytes: number): string {
  if (bytes >= 1048576) return `${decimal(bytes / 1048576, 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
function decodeName(name: string): string {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}
function prettyJson(value: unknown): string {
  try {
    const s = JSON.stringify(value, null, 2);
    return typeof s === "string" ? s : "";
  } catch {
    return "";
  }
}
function plain(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}
function slugify(input: string): string {
  let s = input.toLowerCase();
  s = s.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
  s = s.replace(/[^a-z0-9]+/g, "-").replace(/^-+/, "").replace(/-+$/, "");
  return s.length > 75 ? s.slice(0, 75).replace(/-+$/, "") : s;
}
function firstName(name: string): string {
  const p = name.trim().split(/\s+/)[0] ?? "";
  return p.length > 0 ? p : name;
}
function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return tr("Good evening");
  if (h < 12) return tr("Good morning");
  if (h < 18) return tr("Good afternoon");
  return tr("Good evening");
}

// ---------- content type look -------------------------------------------

/** CMS types carry Lucide icon names; map the common ones to SF Symbols. */
const LUCIDE_TO_SF: Record<string, string> = {
  "chef-hat": "fork.knife",
  carrot: "carrot",
  store: "storefront",
  handshake: "person.2",
  quote: "quote.bubble",
  newspaper: "newspaper",
  lightbulb: "lightbulb",
  "help-circle": "questionmark.circle",
  "circle-help": "questionmark.circle",
  image: "photo",
  images: "photo.on.rectangle",
  file: "doc.text",
  "file-text": "doc.text",
  "pen-line": "square.and.pencil",
  pen: "square.and.pencil",
  pencil: "pencil",
  book: "book",
  "book-open": "book",
  "alert-triangle": "exclamationmark.triangle",
  "triangle-alert": "exclamationmark.triangle",
  "form-input": "list.bullet.rectangle",
  calendar: "calendar",
  users: "person.2",
  user: "person",
  tag: "tag",
  "shopping-bag": "bag",
  package: "shippingbox",
  "map-pin": "mappin.and.ellipse",
  star: "star",
  heart: "heart",
  video: "video",
  music: "music.note",
  briefcase: "briefcase",
  globe: "globe",
  home: "house",
  layout: "rectangle.3.group",
  "layout-grid": "square.grid.2x2",
};
const TYPE_COLORS: Rgba[] = [TILE_ORANGE, TILE_BLUE, TILE_GREEN, TILE_PURPLE, TILE_PINK, TILE_TEAL, TILE_INDIGO, TILE_YELLOW, TILE_RED];

function typeSymbol(t: ContentType | null, slug: string): string {
  const icon = t && t.icon ? t.icon : "";
  const mapped = LUCIDE_TO_SF[icon];
  if (mapped) return mapped;
  const s = slug.toLowerCase();
  if (s.indexOf("page") >= 0) return "doc.text";
  if (s.indexOf("post") >= 0 || s.indexOf("blog") >= 0 || s.indexOf("news") >= 0 || s.indexOf("article") >= 0) return "newspaper";
  if (s.indexOf("product") >= 0) return "bag";
  if (s.indexOf("event") >= 0) return "calendar";
  if (s.indexOf("faq") >= 0) return "questionmark.circle";
  if (s.indexOf("team") >= 0 || s.indexOf("person") >= 0 || s.indexOf("people") >= 0) return "person.2";
  return "square.stack";
}
function typeColor(slug: string): Rgba {
  let idx = 0;
  for (let i = 0; i < cTypes.length; i++) {
    const t = cTypes[i];
    if (t && t.slug === slug) idx = i;
  }
  return TYPE_COLORS[idx % TYPE_COLORS.length] ?? TILE_ORANGE;
}
function typeTile(slug: string, size: number): Widget {
  const t = typeBySlug(slug);
  const c = typeColor(slug);
  return softTile(typeSymbol(t, slug), c, tintFill(c), size, false);
}

const STATUS_KEYS = ["published", "draft", "review", "archived"];
const STATUS_LABELS = [tr("Live"), tr("Drafts"), tr("In review"), tr("Archived")];

function statusPill(status: string): Widget {
  if (status === "published") return pill(tr("Live"), K_OK);
  if (status === "draft") return pill(tr("Draft"), K_WARN);
  if (status === "review") return pill(tr("In review"), K_INFO);
  if (status === "scheduled") return pill(tr("Scheduled"), K_BRAND);
  if (status === "archived") return pill(tr("Archived"), K_NEUTRAL);
  return pill(status, K_NEUTRAL);
}
function statusWord(status: string): string {
  if (status === "published") return tr("Live");
  if (status === "draft") return tr("Draft");
  if (status === "review") return tr("In review");
  if (status === "archived") return tr("Archived");
  return status;
}

// ---------- routes -------------------------------------------------------

const R_SIGNIN = "signin";
const R_HOME = "home";
const R_TYPES = "types";
const R_CONTENT = "content";
const R_EDITOR = "editor";
const R_WRITE = "write";
const R_NEW = "new";
const R_MEDIA = "media";
const R_MEDIA_DETAIL = "mediaDetail";
const R_UPLOAD = "upload";
const R_FORMS = "forms";
const R_SUBMISSION = "submission";
const R_MORE = "more";
const R_MENUS = "menus";
const R_MENU = "menu";
const R_MENU_ADD = "menuAdd";
const R_REDIRECTS = "redirects";
const R_REDIRECT_ADD = "redirectAdd";
const R_SETTINGS = "settings";
const R_SETTING = "setting";
const R_WEBHOOKS = "webhooks";
const R_WEBHOOK = "webhook";
const R_JOBS = "jobs";
const R_USERS = "users";
const R_INVITE = "invite";
const R_ACCOUNT = "account";

const TAB_ROOTS = [R_HOME, R_TYPES, R_MEDIA, R_FORMS, R_MORE];
const TAB_LABELS = [tr("Home"), tr("Content"), tr("Media"), tr("Inbox"), tr("More")];
const TAB_ICONS = ["house", "doc.text", "photo.on.rectangle", "tray", "square.grid.2x2"];
const TAB_ICONS_ON = ["house.fill", "doc.text.fill", "photo.fill.on.rectangle.fill", "tray.fill", "square.grid.2x2.fill"];

// ---------- session state ------------------------------------------------

let me: MeResult | null = null;
let siteLocales: string[] = [];
let defaultLocale = "en";

function can(cap: string): boolean {
  if (!me) return false;
  const g = me.capabilities.global;
  return g.indexOf("*") >= 0 || g.indexOf(cap) >= 0;
}
function canType(type: string, verb: string): boolean {
  if (!me) return false;
  const t = me.capabilities.types;
  const all = t["*"];
  if (all && (all.indexOf("*") >= 0 || all.indexOf(verb) >= 0)) return true;
  const own = t[type];
  return !!own && (own.indexOf("*") >= 0 || own.indexOf(verb) >= 0);
}
function localeLabels(): string[] {
  const out: string[] = [];
  for (let i = 0; i < siteLocales.length; i++) out.push((siteLocales[i] ?? "").toUpperCase());
  return out;
}

// ---------- shell widgets ------------------------------------------------

// perry/ui on iOS already lays the root view out inside the safe area, so the
// app adds no status-bar / home-indicator padding of its own there.
const insets = getSafeAreaInsets();
const topInset = isAndroid ? insets.top : 0;
const bottomInset = isAndroid ? insets.bottom : 0;

// The header's children are rebuilt on every render rather than shown/hidden:
// re-showing a detached NSStackView child misplaced it.
const header = column(0);
bg(header, SURFACE);
const headerRule = divider(0);

const noticeWrap = column(0);
setPadding(noticeWrap, 10, isWide ? 32 : PAD, 0, isWide ? 32 : PAD);

const content = column(14);
const scroll = ScrollView();
scrollviewSetChild(scroll, content);
widgetSetHugging(scroll, 1);

// Phone Write screen: the Markdown editor scrolls itself, so it replaces the
// shared ScrollView instead of sitting inside it.
const writePane = column(0);
widgetSetHugging(writePane, 1);
widgetSetHidden(writePane, 1);

const actionInner = HStack(10, []);
stackSetDistribution(actionInner, 1);
setPadding(actionInner, 12, PAD, bottomInset > 0 ? bottomInset : 12, PAD);
const actionBar = column(0);
add(actionBar, divider(0));
add(actionBar, actionInner);
bg(actionBar, SURFACE);

const tabBar = HStack(0, []);
stackSetDistribution(tabBar, 1);
setPadding(tabBar, 6, 4, bottomInset > 8 ? bottomInset - 6 : 6, 4);
const tabWrap = column(0);
add(tabWrap, divider(0));
add(tabWrap, tabBar);
bg(tabWrap, SURFACE);

// Desktop: sidebar | main column. Phones: header / scroll / action bar / tabs.
const sidebar = column(2);
bg(sidebar, SURFACE);
setPadding(sidebar, 18, 12, 14, 12);
const sideRule = VStack(0, []);
widgetSetWidth(sideRule, 1);
bg(sideRule, HAIRLINE);
let root: Widget;
if (isWide) {
  const mainCol = VStack(0, [header, headerRule, noticeWrap, scroll]);
  widgetMatchParentWidth(header);
  widgetMatchParentWidth(headerRule);
  widgetMatchParentWidth(noticeWrap);
  widgetMatchParentWidth(scroll);
  stackSetDetachesHidden(mainCol, 1);
  widgetSetHugging(mainCol, 1);
  root = HStack(0, [sidebar, sideRule, mainCol]);
  widgetSetWidth(sidebar, isPad ? 290 : 240);
  widgetMatchParentHeight(sidebar);
  widgetMatchParentHeight(sideRule);
  widgetMatchParentHeight(mainCol);
  stackSetDetachesHidden(root, 1);
} else {
  root = VStack(0, [header, headerRule, noticeWrap, writePane, scroll, actionBar, tabWrap]);
  widgetMatchParentWidth(header);
  widgetMatchParentWidth(headerRule);
  widgetMatchParentWidth(noticeWrap);
  widgetMatchParentWidth(writePane);
  widgetMatchParentWidth(scroll);
  widgetMatchParentWidth(actionBar);
  widgetMatchParentWidth(tabWrap);
  stackSetDetachesHidden(root, 1);
}
bg(root, BG);

// ---------- notices ------------------------------------------------------

/**
 * kind 0: working (spinner banner), 1: error (red banner, tap to dismiss),
 * 2: success (native toast + haptic). Empty text hides the banner.
 */
function setNotice(message: string, kind: number): void {
  widgetClearChildren(noticeWrap);
  if (message.length === 0) {
    widgetSetHidden(noticeWrap, 1);
    return;
  }
  if (kind === 2) {
    widgetSetHidden(noticeWrap, 1);
    haptic("success");
    showToast(message);
    return;
  }
  if (kind === 1) {
    haptic("error");
    const b = banner(K_DANGER, "exclamationmark.circle.fill", message);
    widgetSetOnClick(b, () => setNotice("", 0));
    add(noticeWrap, b);
  } else {
    const r = hrow(10);
    bg(r, SURFACE);
    setCornerRadius(r, 12);
    setPadding(r, 11, 14, 11, 14);
    put(r, fixed(ProgressView(), 20, 20));
    put(r, grow(text(message, 14, 500, BODY, 0)));
    add(noticeWrap, r);
  }
  widgetSetHidden(noticeWrap, 0);
}

/**
 * Report a failed request. A 401 means the session is gone (expired, or
 * revoked by a password change), so that drops back to sign-in instead.
 */
function fail(e: unknown): void {
  if (e instanceof ApiError && e.status === 401 && me) {
    endSession(tr("Your session has ended. Sign in again."));
    return;
  }
  setNotice(errorMessage(e), 1);
}

function confirm(title: string, message: string, actionLabel: string, onConfirm: () => void): void {
  alertWithButtons(title, message, [tr("Cancel"), actionLabel], (index: number) => {
    if (index === 1) onConfirm();
  });
}
/** A list of actions in an alert, with Cancel last. */
function actionMenu(title: string, labels: string[], handlers: (() => void)[]): void {
  const all = labels.slice(0);
  all.push(tr("Cancel"));
  alertWithButtons(title, "", all, (index: number) => {
    const h = handlers[index];
    if (h) h();
  });
}

// ---------- navigation ---------------------------------------------------

let navStack: string[] = [R_SIGNIN];
/** Header titles and scroll offsets per stack entry (for Back). */
let navTitles: string[] = [""];
let navOffsets: number[] = [0];
let activeTab = 0;
/** Bumped on every render; async loaders drop their result if it moved on. */
let renderSeq = 0;

function currentRoute(): string {
  return navStack[navStack.length - 1] ?? R_SIGNIN;
}
function isCurrent(seq: number): boolean {
  return seq === renderSeq;
}
function alive(seq: number): () => boolean {
  return () => seq === renderSeq;
}

function go(route: string): void {
  navOffsets[navStack.length - 1] = scrollviewGetOffset(scroll);
  navStack.push(route);
  navTitles.push("");
  navOffsets.push(0);
  render(true);
}

function leave(): void {
  if (navStack.length > 1) {
    navStack.pop();
    navTitles.pop();
    navOffsets.pop();
  }
  render(false);
  const y = navOffsets[navStack.length - 1] ?? 0;
  if (y > 0) setTimeout(() => scrollviewSetOffset(scroll, 0, y), 40);
}

function goBack(): void {
  if (navStack.length <= 1) return;
  if (currentRoute() === R_EDITOR && edDirty) {
    confirm(tr("Discard changes?"), tr("Your edits to this item haven't been saved."), tr("Discard"), () => {
      edDirty = false;
      leave();
    });
    return;
  }
  leave();
}

function switchTab(index: number): void {
  if (currentRoute() === R_EDITOR && edDirty) {
    confirm(tr("Discard changes?"), tr("Your edits to this item haven't been saved."), tr("Discard"), () => {
      edDirty = false;
      switchTab(index);
    });
    return;
  }
  if (index === activeTab && navStack.length === 1) {
    scrollviewSetOffset(scroll, 0, 0);
    return;
  }
  activeTab = index;
  navStack = [TAB_ROOTS[index] ?? R_HOME];
  navTitles = [""];
  navOffsets = [0];
  render(true);
}

/** Desktop sidebar entry: jump to a top-level screen. */
function navRoot(route: string): void {
  if (currentRoute() === R_EDITOR && edDirty) {
    confirm(tr("Discard changes?"), tr("Your edits to this item haven't been saved."), tr("Discard"), () => {
      edDirty = false;
      navRoot(route);
    });
    return;
  }
  activeTab = TAB_ROOTS.indexOf(route);
  navStack = [route];
  navTitles = [""];
  navOffsets = [0];
  render(true);
}

function sideItem(icon: string, label: string, route: string, badgeCount: number): Widget {
  const on = (navStack[0] ?? "") === route;
  const r = hrow(isPad ? 12 : 10);
  // iPad: 44 pt rows (touch); desktop: compact pointer rows.
  if (isPad) setPadding(r, 11, 12, 11, 12);
  else setPadding(r, 7, 10, 7, 10);
  setCornerRadius(r, isPad ? 10 : 8);
  put(r, symbol(icon, isPad ? 19 : 16, on ? BRAND_INK : MUTED));
  put(r, grow(text(label, isPad ? 17 : 14, on ? 600 : 500, on ? INK : BODY, 1)));
  if (badgeCount > 0) put(r, pill(String(badgeCount), K_DANGER));
  const rest: Rgba = on ? SURFACE3 : [0, 0, 0, 0];
  bg(r, rest);
  onTap(r, () => navRoot(route));
  hoverTint(r, rest);
  return r;
}
function sideLabel(t: string): Widget {
  const box = HStack(0, [text(t.toUpperCase(), isPad ? 12 : 11, 600, FAINT, 1)]);
  setPadding(box, isPad ? 20 : 16, isPad ? 12 : 10, isPad ? 6 : 4, 10);
  return box;
}

function siteMenu(): void {
  const labels: string[] = [tr("Visit website")];
  const handlers: (() => void)[] = [() => openURL(api.getBaseUrl())];
  const sites = store.loadSites();
  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    if (!s || s.baseUrl === api.getBaseUrl()) continue;
    labels.push(tr("Switch to {site}", { site: siteName(s.baseUrl) }));
    handlers.push(() => switchSite(s));
  }
  labels.push(tr("Add a site"));
  handlers.push(() => addAnotherSite());
  labels.push(tr("Sign out"));
  handlers.push(() => {
    void doSignOut();
  });
  actionMenu(siteName(api.getBaseUrl()), labels, handlers);
}

function paintSidebar(): void {
  widgetClearChildren(sidebar);
  const brand = hrow(10);
  setPadding(brand, 4, 8, 14, 8);
  put(brand, logoMark(isPad ? 38 : 32));
  const bt = column(0);
  put(bt, text(siteName(api.getBaseUrl()), isPad ? 17 : 14, 700, INK, 1));
  put(bt, text("Skelpo CMS", isPad ? 14 : 12, 500, MUTED, 1));
  put(brand, grow(bt));
  put(brand, symbol("chevron.up.chevron.down", 12, FAINT));
  setCornerRadius(brand, 10);
  onTap(brand, () => siteMenu());
  hoverTint(brand, [0, 0, 0, 0]);
  add(sidebar, brand);
  add(sidebar, sideItem("house", tr("Home"), R_HOME, 0));
  add(sidebar, sideItem("doc.text", tr("Content"), R_TYPES, 0));
  add(sidebar, sideItem("photo.on.rectangle", tr("Media"), R_MEDIA, 0));
  add(sidebar, sideItem("tray", tr("Inbox"), R_FORMS, 0));
  const site: Widget[] = [];
  if (can("manageMenus")) site.push(sideItem("list.bullet.rectangle", tr("Menus"), R_MENUS, 0));
  if (can("manageRedirects")) site.push(sideItem("arrow.triangle.branch", tr("Redirects"), R_REDIRECTS, 0));
  if (can("manageSettings")) site.push(sideItem("gearshape", tr("Settings"), R_SETTINGS, 0));
  if (can("manageUsers")) site.push(sideItem("person.2", tr("Team"), R_USERS, 0));
  if (site.length > 0) {
    add(sidebar, sideLabel(tr("Website")));
    for (let i = 0; i < site.length; i++) {
      const w = site[i];
      if (w) add(sidebar, w);
    }
  }
  const dev: Widget[] = [];
  if (can("manageSettings")) dev.push(sideItem("bolt", tr("Webhooks"), R_WEBHOOKS, 0));
  if (can("manageJobs")) dev.push(sideItem("clock.arrow.circlepath", tr("Background jobs"), R_JOBS, hJobsBad));
  if (dev.length > 0) {
    add(sidebar, sideLabel(tr("Developer")));
    for (let i = 0; i < dev.length; i++) {
      const w = dev[i];
      if (w) add(sidebar, w);
    }
  }
  put(sidebar, Spacer());
  const who = me;
  if (who) {
    const u = hrow(10);
    setPadding(u, 8, 8, 8, 8);
    setCornerRadius(u, 10);
    put(u, avatar(who.user.displayName, who.user.email, isPad ? 36 : 30));
    const ut = column(0);
    put(ut, text(who.user.displayName, isPad ? 15 : 13, 600, INK, 1));
    put(ut, text(who.user.role.label, isPad ? 13 : 12, 400, MUTED, 1));
    put(u, grow(ut));
    const rest: Rgba = (navStack[0] ?? "") === R_ACCOUNT ? SURFACE3 : [0, 0, 0, 0];
    bg(u, rest);
    onTap(u, () => navRoot(R_ACCOUNT));
    hoverTint(u, rest);
    add(sidebar, u);
  }
}

function paintTabs(): void {
  widgetClearChildren(tabBar);
  for (let i = 0; i < TAB_LABELS.length; i++) {
    const index = i;
    const on = i === activeTab;
    const c = on ? BRAND_INK : FAINT;
    const v = centerColumn(3);
    setPadding(v, 4, 0, 2, 0);
    put(v, symbol((on ? TAB_ICONS_ON[i] : TAB_ICONS[i]) ?? "circle", 23, c));
    put(v, text(TAB_LABELS[i] ?? "", 10, 600, on ? BRAND_INK : MUTED, 1));
    widgetSetOnClick(v, () => {
      haptic("light");
      switchTab(index);
    });
    put(tabBar, v);
  }
}

// ---------- header -------------------------------------------------------

/** Tab-root header: optional eyebrow line, large title, trailing actions. */
/** Trailing area of the current header; desktop puts screen actions here. */
let headerRight: Widget | null = null;

/** Desktop toolbar header: back button + breadcrumb, title, actions. */
function setDesktopHeader(eyebrow: string, title: string, trailing: Widget[]): void {
  navTitles[navStack.length - 1] = title;
  widgetClearChildren(header);
  setPadding(header, 18, 32, 16, 28);
  const r = hrow(14);
  if (navStack.length > 1) {
    const back = softTile("chevron.left", INK, SURFACE2, isPad ? 40 : 34, true);
    onTap(back, () => goBack());
    put(r, back);
  }
  const texts = column(1);
  let crumb = eyebrow;
  if (navStack.length > 1) {
    const parts: string[] = [];
    for (let i = 0; i < navStack.length - 1; i++) {
      const t = navTitles[i] ?? "";
      if (t.length > 0) parts.push(t);
    }
    crumb = parts.join("  ›  ");
  }
  if (crumb.length > 0) put(texts, text(crumb, isPad ? 15 : 13, 500, MUTED, 1));
  put(texts, text(title, navStack.length > 1 ? (isPad ? 26 : 22) : isPad ? 32 : 26, 700, INK, 1));
  put(r, grow(texts));
  put(r, Spacer());
  const right = hrow(8);
  widgetSetHugging(right, 750);
  for (let i = 0; i < trailing.length; i++) {
    const w = trailing[i];
    if (w) put(right, w);
  }
  headerRight = right;
  put(r, right);
  add(header, r);
}

function setLargeHeader(eyebrow: string, title: string, trailing: Widget[], onTitleTap: (() => void) | null = null): void {
  if (isWide) {
    setDesktopHeader(eyebrow, title, trailing);
    return;
  }
  navTitles[navStack.length - 1] = title;
  widgetClearChildren(header);
  setPadding(header, topInset + 6, PAD + 4, 10, PAD);
  const r = hrow(10);
  const texts = column(0);
  if (eyebrow.length > 0) put(texts, text(eyebrow, 14, 500, MUTED, 1));
  if (onTitleTap) {
    // Tappable title (Home: site switcher), with a chevron like iOS menus.
    const t = hrow(6);
    put(t, largeTitle(title));
    put(t, symbol("chevron.down.circle.fill", 20, FAINT));
    onTap(t, onTitleTap);
    put(texts, t);
  } else put(texts, largeTitle(title));
  put(r, grow(texts));
  for (let i = 0; i < trailing.length; i++) {
    const w = trailing[i];
    if (w) put(r, w);
  }
  add(header, r);
}

/** Pushed-screen header: back button, centred title, trailing actions. */
function setBarHeader(title: string, trailing: Widget[]): void {
  if (isWide) {
    setDesktopHeader("", title, trailing);
    return;
  }
  navTitles[navStack.length - 1] = title;
  widgetClearChildren(header);
  setPadding(header, topInset, 6, 0, 8);
  const r = hrow(0);
  widgetSetHeight(r, 48);
  const left = hrow(2);
  if (navStack.length > 1) {
    const prev = navTitles[navStack.length - 2] ?? "";
    const backLabel = prev.length > 0 && prev.length <= 11 ? prev : tr("Back");
    put(left, symbol("chevron.left", 19, BRAND_INK));
    put(left, text(backLabel, 17, 400, BRAND_INK, 1));
    setPadding(left, 8, 4, 8, 4);
    onTap(left, () => goBack());
  }
  put(r, fixed(left, 104, 44));
  put(r, grow(centeredLabel(text(title, 17, 600, INK, 1), 44, 17)));
  const right = hrow(4);
  put(right, Spacer());
  for (let i = 0; i < trailing.length; i++) {
    const w = trailing[i];
    if (w) put(right, w);
  }
  put(r, fixed(right, 104, 44));
  add(header, r);
}

/** Text action for a bar header ("Save", "Done"). */
function headerText(label: string, run: () => void): Widget {
  const t = text(label, 17, 600, BRAND_INK, 1);
  const box = HStack(0, [t]);
  setPadding(box, 8, 6, 8, 4);
  widgetSetHugging(box, 750);
  onTap(box, run);
  return box;
}
function headerIcon(name: string, run: () => void): Widget {
  return iconButton(name, BRAND_INK, run);
}
/** Header action: an icon on phones, a labelled button on desktop. */
function headerAction(icon: string, label: string, run: () => void): Widget {
  if (isWide) return chipButton(label, icon, B_SECONDARY, run);
  return iconButton(icon, BRAND_INK, run);
}
/** Round tinted icon for large headers (Shopify-style). */
function circleAction(name: string, run: () => void): Widget {
  const b = softTile(name, INK, SURFACE2, 38, true);
  onTap(b, run);
  return b;
}

/** Replace the tab bar with a bar of buttons (editor, forms). */
function setActions(buttons: Widget[]): void {
  if (isWide) {
    const right = headerRight;
    if (!right) return;
    for (let i = 0; i < buttons.length; i++) {
      const b = buttons[i];
      if (!b) continue;
      widgetSetHugging(b, 750);
      put(right, b);
    }
    return;
  }
  widgetClearChildren(actionInner);
  for (let i = 0; i < buttons.length; i++) {
    const b = buttons[i];
    if (b) put(actionInner, b);
  }
  widgetSetHidden(actionBar, 0);
  widgetSetHidden(tabWrap, 1);
}

// ---------- render -------------------------------------------------------

/**
 * Rebuild the visible screen. `reload` true = fetch fresh data (forward
 * navigation, tab switch, pull-to-refresh); false = redraw from caches (Back).
 */
function render(reload: boolean): void {
  renderSeq++;
  const seq = renderSeq;
  const route = currentRoute();
  setNotice("", 0);
  widgetClearChildren(content);
  setPadding(content, isWide ? 24 : 14, GUTTER, isWide ? 48 : 36, GUTTER);
  scrollviewSetOffset(scroll, 0, 0);
  const signedOut = route === R_SIGNIN;
  headerRight = null;
  bg(header, SURFACE);
  widgetSetHidden(header, signedOut ? 1 : 0);
  widgetSetHidden(headerRule, signedOut ? 1 : 0);
  widgetSetHidden(actionBar, 1);
  const writing = route === R_WRITE && !isWide;
  if (isWide) {
    widgetSetHidden(sidebar, signedOut ? 1 : 0);
    widgetSetHidden(sideRule, signedOut ? 1 : 0);
    if (!signedOut) paintSidebar();
  } else {
    widgetSetHidden(tabWrap, signedOut || writing ? 1 : 0);
    if (!signedOut) paintTabs();
    widgetSetHidden(writePane, writing ? 0 : 1);
    widgetSetHidden(scroll, writing ? 1 : 0);
  }

  if (route === R_SIGNIN) screenSignIn();
  else if (route === R_HOME) screenHome(seq, reload);
  else if (route === R_TYPES) screenTypes(seq, reload);
  else if (route === R_CONTENT) screenContent(seq, reload);
  else if (route === R_EDITOR) screenEditor();
  else if (route === R_WRITE) screenWrite();
  else if (route === R_NEW) screenNewItem();
  else if (route === R_MEDIA) screenMedia(seq, reload);
  else if (route === R_MEDIA_DETAIL) screenMediaDetail();
  else if (route === R_UPLOAD) screenUpload();
  else if (route === R_FORMS) screenInbox(seq, reload);
  else if (route === R_SUBMISSION) screenSubmission();
  else if (route === R_MORE) screenMore();
  else if (route === R_MENUS) screenMenus(seq, reload);
  else if (route === R_MENU) screenMenu(seq, reload);
  else if (route === R_MENU_ADD) screenMenuAdd();
  else if (route === R_REDIRECTS) screenRedirects(seq, reload);
  else if (route === R_REDIRECT_ADD) screenRedirectAdd();
  else if (route === R_SETTINGS) screenSettings(seq, reload);
  else if (route === R_SETTING) screenSetting();
  else if (route === R_WEBHOOKS) screenWebhooks(seq, reload);
  else if (route === R_WEBHOOK) screenWebhook(seq, reload);
  else if (route === R_JOBS) screenJobs(seq, reload);
  else if (route === R_USERS) screenUsers(seq, reload);
  else if (route === R_INVITE) screenInvite();
  else if (route === R_ACCOUNT) screenAccount();
}

function showSkeleton(seq: number, rows: number, thumbs: boolean): void {
  add(content, skeletonList(rows, thumbs, alive(seq)));
}

// ---------- sign in ------------------------------------------------------

let inUrl = "";
let inEmail = "";
let inPassword = "";
let inTotp = "";
let signInNeedsTotp = false;
let signInBusy = false;
let signInMessage = "";

function screenSignIn(): void {
  setPadding(content, isWide ? 72 : 0, 0, 40, 0);
  const hero = column(0);
  if (isWide) widgetSetHidden(hero, 1);
  // Vertical gradient (direction < 0.5) so its top matches the status-bar strip.
  widgetSetBackgroundGradient(hero, BRAND[0], BRAND[1], BRAND[2], 1, BRAND_DEEP[0], BRAND_DEEP[1], BRAND_DEEP[2], 1, 0);
  setPadding(hero, 28, 24, 30, 24);
  put(hero, logoMarkWhite(60));
  put(hero, gap(18));
  const t = text("Skelpo CMS", 30, 700, WHITE, 1);
  put(hero, t);
  put(hero, gap(6));
  add(hero, text(tr("Your website in your pocket. Edit pages, photos and messages from anywhere."), 16, 400, [1, 1, 1, 0.9], 0));
  if (!isWide) add(content, hero);

  const body = column(10);
  setPadding(body, 6, PAD, 0, PAD);
  if (isWide) {
    // Desktop and iPad: a centred card, Shopify-admin style.
    const brand = centerColumn(10);
    put(brand, logoMark(60));
    put(brand, gap(4));
    put(brand, text(tr("Sign in to Skelpo CMS"), 26, 700, INK, 1));
    put(brand, text(tr("Manage your website's pages, media and messages."), 15, 400, MUTED, 1));
    put(brand, gap(8));
    add(body, brand);
  }
  const saved = store.loadSites();
  if (saved.length > 0) {
    add(body, groupLabel(tr("Continue")));
    const rows: Widget[] = [];
    for (let i = 0; i < saved.length; i++) {
      const site = saved[i];
      if (!site) continue;
      rows.push(
        item(avatar(siteName(site.baseUrl), site.baseUrl, 38), siteName(site.baseUrl), site.email, null, true, () => {
          void resumeSite(site);
        }),
      );
    }
    add(body, group(rows, 66));
  }
  add(body, groupLabel(saved.length > 0 ? tr("Add a site") : tr("Sign in")));
  const form = card(16, 14);
  if (signInMessage.length > 0) add(form, banner(K_DANGER, "exclamationmark.circle.fill", signInMessage));
  add(
    form,
    field(
      tr("Website"),
      null,
      input("www.example.com", inUrl, false, "globe", (s: string) => {
        inUrl = s;
      }),
      "",
    ),
  );
  add(
    form,
    field(
      tr("Email"),
      null,
      input(tr("you@example.com"), inEmail, false, "envelope", (s: string) => {
        inEmail = s;
      }),
      "",
    ),
  );
  add(
    form,
    field(
      tr("Password"),
      null,
      input(tr("Password"), inPassword, true, "lock", (s: string) => {
        inPassword = s;
      }),
      "",
    ),
  );
  if (signInNeedsTotp) {
    add(
      form,
      field(
        tr("Authenticator code"),
        null,
        input("123 456", inTotp, false, "number", (s: string) => {
          inTotp = s;
        }),
        tr("The 6-digit code from your authenticator app."),
      ),
    );
  }
  add(
    form,
    button(signInBusy ? tr("Signing in…") : tr("Sign in"), "", B_PRIMARY, 52, () => {
      void doSignIn();
    }),
  );
  add(body, form);
  const note = text(tr("Works with every website that runs Skelpo CMS. Your sign-in is stored in this device's keychain."), 13, 400, MUTED, 0);
  textSetTextAlignment(note, 2);
  const noteBox = HStack(0, [note]);
  setPadding(noteBox, 8, 20, 0, 20);
  widgetMatchParentWidth(note);
  add(body, noteBox);
  if (isWide) {
    const wrap = centerColumn(0);
    put(wrap, fixed(body, 460, 0));
    add(content, wrap);
  } else {
    add(content, body);
  }
}

async function doSignIn(): Promise<void> {
  if (signInBusy) return;
  const url = api.normalizeBaseUrl(inUrl);
  const email = inEmail.trim().toLowerCase();
  if (url.length === 0 || email.length === 0 || inPassword.length === 0) {
    signInMessage = tr("Enter the website address, your email and your password.");
    haptic("error");
    render(false);
    return;
  }
  if (signInNeedsTotp && inTotp.trim().length === 0) {
    signInMessage = tr("Enter the 6-digit code from your authenticator app.");
    haptic("error");
    render(false);
    return;
  }
  signInBusy = true;
  signInMessage = "";
  render(false);
  api.setBaseUrl(url);
  api.setSessionToken(null);
  try {
    await api.probeServer();
    const res = await api.login(email, inPassword, signInNeedsTotp ? inTotp.replace(/\s+/g, "") : undefined);
    store.saveSite({ baseUrl: api.getBaseUrl(), email: res.user.email, token: res.token, expiresAt: res.expiresAt });
    inPassword = "";
    inTotp = "";
    signInNeedsTotp = false;
    signInBusy = false;
    haptic("success");
    await startSession();
  } catch (e) {
    signInBusy = false;
    if (api.isTotpRequired(e)) {
      const wasAsking = signInNeedsTotp;
      signInNeedsTotp = true;
      signInMessage = wasAsking ? tr("That code wasn't accepted. Try the current one.") : tr("This account uses two-factor sign-in. Enter your authenticator code.");
    } else if (e instanceof ApiError && e.status === 401) {
      signInMessage = tr("Email or password is incorrect.");
    } else if (e instanceof ApiError && e.status === 404) {
      signInMessage = tr("No Skelpo CMS found at {host}. Check the address, or ask your developer to expose /api/v1.", { host: hostOf(url) });
    } else {
      signInMessage = errorMessage(e);
    }
    haptic("error");
    render(false);
  }
}

/** Continue with a saved site. */
async function resumeSite(site: store.SavedSite): Promise<void> {
  api.setBaseUrl(site.baseUrl);
  api.setSessionToken(site.token);
  store.setActiveSite(site.baseUrl);
  showSplash(site.baseUrl);
  try {
    await startSession();
  } catch (e) {
    navStack = [R_SIGNIN];
    navTitles = [""];
    navOffsets = [0];
    if (e instanceof ApiError && e.status === 401) {
      store.removeSite(site.baseUrl);
      inUrl = site.baseUrl;
      inEmail = site.email;
      signInMessage = tr("That session has expired. Sign in again.");
      api.setSessionToken(null);
      render(false);
      return;
    }
    signInMessage = errorMessage(e);
    render(false);
  }
}

/** Load identity + site config for the current base URL/token, then show the app. */
async function startSession(): Promise<void> {
  const who = await api.me();
  me = who;
  siteLocales = [];
  defaultLocale = who.user.locale.length > 0 ? who.user.locale : "en";
  try {
    const settings = await api.getSettings();
    const locales = settings["site.locales"];
    if (Array.isArray(locales)) {
      for (let i = 0; i < locales.length; i++) {
        const l = locales[i];
        if (typeof l === "string" && l.length > 0) siteLocales.push(l);
      }
    }
    const def = settings["site.defaultLocale"];
    if (typeof def === "string" && def.length > 0) defaultLocale = def;
  } catch {
    // settings are optional context; fall back to the user's locale
  }
  if (siteLocales.length === 0) siteLocales = [defaultLocale];
  if (siteLocales.indexOf(defaultLocale) < 0) defaultLocale = siteLocales[0] ?? defaultLocale;
  resetCaches();
  signInMessage = "";
  activeTab = 0;
  navStack = [R_HOME];
  navTitles = [""];
  navOffsets = [0];
  render(true);
  void maybeRefreshSession();
  void devNavigate();
}

async function devNavigate(): Promise<void> {
  const tab = devEnv("SKELPO_DEV_TAB");
  if (tab.length > 0) switchTab(Number(tab));
  // _ACTION=upload opens the photo picker, _ACTION=share the share sheet
  // (checks the native pickers without a UI driver).
  const action = devEnv("SKELPO_DEV_ACTION");
  if (action === "upload") setTimeout(() => startUpload(), 1500);
  else if (action === "share") setTimeout(() => shareUrl(api.getBaseUrl(), siteName(api.getBaseUrl())), 1500);
  const typeSlug = devEnv("SKELPO_DEV_TYPE");
  if (typeSlug.length === 0) return;
  try {
    await ensureTypes();
  } catch {
    return;
  }
  const t = typeBySlug(typeSlug);
  if (!t) return;
  if (activeTab !== 1) switchTab(1);
  openType(t);
  if (devEnv("SKELPO_DEV_EDIT") !== "1") return;
  const page = await api.listContent({ type: t.slug, status: "published", limit: 1 });
  const first = page.data[0];
  if (!first) return;
  openEditor(first);
  // _WRITE=<field>: open the Markdown Write screen for that field.
  const wf = devEnv("SKELPO_DEV_WRITE");
  if (wf.length > 0) {
    const ed = mdEditorFor(wf);
    let label = wf;
    const defs = t.fieldsSchema.fields;
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i];
      if (d && d.name === wf && d.label) label = d.label;
    }
    openWriter(wf, label);
    if (devEnv("SKELPO_DEV_FOCUS") === "1") setTimeout(() => focusEditor(ed), 800);
  }
}

/** Rotate the session only when it is within a week of its 30-day expiry. */
async function maybeRefreshSession(): Promise<void> {
  const site = store.loadActiveSite();
  if (!site || site.baseUrl !== api.getBaseUrl() || site.expiresAt.length === 0) return;
  const expires = new Date(site.expiresAt).getTime();
  if (!(expires > 0)) return;
  if (expires - Date.now() > 7 * 24 * 3600 * 1000) return;
  try {
    const res = await api.refreshSession();
    store.saveSite({ baseUrl: api.getBaseUrl(), email: res.user.email, token: res.token, expiresAt: res.expiresAt });
  } catch {
    // keep using the current session until it actually expires
  }
}

/** Drop the current session locally and return to sign-in. */
function endSession(message: string): void {
  const url = api.getBaseUrl();
  if (url.length > 0) store.removeSite(url);
  api.setSessionToken(null);
  me = null;
  resetCaches();
  inUrl = url;
  inPassword = "";
  signInMessage = message;
  navStack = [R_SIGNIN];
  navTitles = [""];
  navOffsets = [0];
  render(false);
}

async function doSignOut(): Promise<void> {
  setNotice(tr("Signing out…"), 0);
  await api.logout();
  endSession("");
}

function addAnotherSite(): void {
  me = null;
  inUrl = "";
  inEmail = "";
  inPassword = "";
  signInMessage = "";
  api.setSessionToken(null);
  navStack = [R_SIGNIN];
  navTitles = [""];
  navOffsets = [0];
  render(false);
}

function showSplash(baseUrl: string): void {
  renderSeq++;
  widgetSetHidden(sidebar, 1);
  widgetSetHidden(sideRule, 1);
  widgetSetHidden(header, 1);
  widgetSetHidden(headerRule, 1);
  widgetSetHidden(tabWrap, 1);
  widgetSetHidden(actionBar, 1);
  setNotice("", 0);
  widgetClearChildren(content);
  setPadding(content, 0, 0, 0, 0);
  const v = centerColumn(14);
  setPadding(v, topInset + 170, 24, 0, 24);
  put(v, logoMark(76));
  put(v, gap(6));
  put(v, text("Skelpo CMS", 22, 700, INK, 1));
  put(v, ProgressView());
  put(v, text(tr("Connecting to {site}…", { site: siteName(baseUrl) }), 14, 400, MUTED, 1));
  add(content, v);
}

async function boot(): Promise<void> {
  const site = store.loadActiveSite();
  inUrl = store.loadLastUrl();
  const devUrl = devEnv("SKELPO_DEV_URL");
  if (!site && devUrl.length > 0) {
    inUrl = devUrl;
    inEmail = devEnv("SKELPO_DEV_EMAIL");
    inPassword = devEnv("SKELPO_DEV_PASSWORD");
    render(false);
    void doSignIn();
    return;
  }
  if (!site) {
    render(false);
    return;
  }
  showSplash(site.baseUrl);
  api.setBaseUrl(site.baseUrl);
  api.setSessionToken(site.token);
  try {
    await startSession();
  } catch (e) {
    inUrl = site.baseUrl;
    inEmail = site.email;
    if (e instanceof ApiError && e.status === 401) {
      store.removeSite(site.baseUrl);
      signInMessage = tr("Your session has expired. Sign in again.");
    } else {
      // Offline or server down: keep the saved session so it can be retried.
      signInMessage = errorMessage(e);
    }
    api.setSessionToken(null);
    navStack = [R_SIGNIN];
    render(false);
  }
}

// ---------- caches -------------------------------------------------------

let cTypes: ContentType[] = [];
let cTypesLoaded = false;

let selType: ContentType | null = null;
let contentStatus = 0;
let contentLocale = "";
let contentFilter = "";
let cContent: ContentItem[] = [];
let cContentCursor: string | null = null;
let cContentHasMore = false;
let contentStale = false;
let contentListBox: Widget | null = null;

let cMedia: MediaItem[] = [];
let mediaById: Record<string, MediaItem> = {};
let mediaLoaded = false;
let selMedia: MediaItem | null = null;
let mediaFilter = "";
let mediaShown = 36;
let mediaGridBox: Widget | null = null;
/** Set while the media list is choosing an image for an editor field. */
let pickField = "";
let pickAppend = false;

interface InboxEntry {
  s: FormSubmission;
  formSlug: string;
  formTitle: string;
}
let cForms: { slug: string; title: string }[] = [];
let cInbox: InboxEntry[] = [];
let inboxLoaded = false;
let inboxSpam = false;
let inboxForm = -1;
let inboxListBox: Widget | null = null;
let selEntry: InboxEntry | null = null;

let homeLoaded = false;
let hDrafts: ContentItem[] = [];
let hDraftCount = 0;
let hReviewCount = 0;
let hDraftsCapped = false;
let hJobsBad = 0;

let cMenus: MenuSummary[] = [];
let menusLoaded = false;
let selMenu: MenuSummary | null = null;
let cMenuItems: { item: MenuItem; depth: number }[] = [];
let menuItemsFor = "";

let cRedirects: Redirect[] = [];
let redirectsLoaded = false;

let cSettings: { key: string; value: unknown }[] = [];
let settingsLoaded = false;
let settingsFilter = "";
let settingsListBox: Widget | null = null;
let selSettingKey = "";
let selSettingText = "";
let selSettingIsString = false;

let cWebhooks: Webhook[] = [];
let webhooksLoaded = false;
let selWebhook: Webhook | null = null;
let cDeliveries: WebhookDelivery[] = [];
let deliveriesFor = -1;

let cJobs: JobSummary[] = [];
let cJobStats: Record<string, number> = {};
let jobsLoaded = false;
let jobsListError = "";

let cUsers: UserListItem[] = [];
let cRoles: Role[] = [];
let usersLoaded = false;

function resetCaches(): void {
  cTypes = [];
  cTypesLoaded = false;
  selType = null;
  contentStatus = 0;
  contentLocale = "";
  contentFilter = "";
  cContent = [];
  cContentCursor = null;
  cContentHasMore = false;
  cMedia = [];
  mediaById = {};
  mediaLoaded = false;
  selMedia = null;
  mediaFilter = "";
  mediaShown = 36;
  pickField = "";
  cForms = [];
  cInbox = [];
  inboxLoaded = false;
  inboxSpam = false;
  inboxForm = -1;
  selEntry = null;
  homeLoaded = false;
  hDrafts = [];
  hDraftCount = 0;
  hReviewCount = 0;
  hDraftsCapped = false;
  hJobsBad = 0;
  cMenus = [];
  menusLoaded = false;
  cMenuItems = [];
  menuItemsFor = "";
  cRedirects = [];
  redirectsLoaded = false;
  cSettings = [];
  settingsLoaded = false;
  settingsFilter = "";
  cWebhooks = [];
  webhooksLoaded = false;
  cDeliveries = [];
  deliveriesFor = -1;
  cJobs = [];
  cJobStats = {};
  jobsLoaded = false;
  cUsers = [];
  cRoles = [];
  usersLoaded = false;
  edItem = null;
  edDirty = false;
}

function setMedia(list: MediaItem[]): void {
  cMedia = list;
  mediaById = {};
  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    if (m) mediaById[String(m.id)] = m;
  }
  mediaLoaded = true;
}

async function ensureTypes(): Promise<void> {
  if (cTypesLoaded) return;
  const types = await api.listTypes();
  cTypes = types.filter((t) => t.slug !== "form");
  cTypesLoaded = true;
}
async function ensureMedia(): Promise<void> {
  if (mediaLoaded) return;
  setMedia(await api.listMedia(200));
}

function typeBySlug(slug: string): ContentType | null {
  for (let i = 0; i < cTypes.length; i++) {
    const t = cTypes[i];
    if (t && t.slug === slug) return t;
  }
  return selType && selType.slug === slug ? selType : null;
}
function visibleTypes(): ContentType[] {
  const out: ContentType[] = [];
  for (let i = 0; i < cTypes.length; i++) {
    const t = cTypes[i];
    if (t && (canType(t.slug, "read") || canType(t.slug, "update"))) out.push(t);
  }
  return out;
}

// ---------- images -------------------------------------------------------

function isPicture(m: MediaItem): boolean {
  return m.mimeType.indexOf("image/") === 0 && m.mimeType !== "image/svg+xml";
}
/** Above this a list thumbnail shows an icon instead of downloading. */
const THUMB_MAX_BYTES = 4 * 1024 * 1024;

/** Rounded square thumbnail of a media id, or null when it can't show one. */
function mediaThumb(id: number, size: number): Widget | null {
  const m = mediaById[String(id)];
  if (m && (!isPicture(m) || m.sizeBytes > THUMB_MAX_BYTES)) return null;
  const img = Image(api.mediaRawUrl(id), "");
  fixed(img, size, size);
  bg(img, SURFACE2);
  setCornerRadius(img, Math.round(size * 0.24));
  return img;
}
/** The first image field's media id of an item, or 0. */
function leadImageId(item: ContentItem): number {
  const t = typeBySlug(item.type);
  if (!t) return 0;
  const defs = t.fieldsSchema.fields;
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    if (!d || d.type !== "image") continue;
    const v = item.fields[d.name];
    if (typeof v === "number" && v > 0) return v;
  }
  return 0;
}
function contentLead(item: ContentItem, size: number): Widget {
  const id = leadImageId(item);
  if (id > 0 && mediaLoaded) {
    const th = mediaThumb(id, size);
    if (th) return th;
  }
  return typeTile(item.type, size);
}

// ---------- home ---------------------------------------------------------

function screenHome(seq: number, reload: boolean): void {
  const who = me;
  const name = who ? firstName(who.user.displayName) : "";
  const trailing: Widget[] = [];
  if (who && !isWide) {
    const av = avatar(who.user.displayName, who.user.email, 38);
    onTap(av, () => go(R_ACCOUNT));
    trailing.push(av);
  }
  setLargeHeader(`${greeting()}${name.length > 0 ? `, ${name}` : ""}`, siteName(api.getBaseUrl()), trailing, () => siteMenu());
  if (homeLoaded) drawHome();
  else {
    add(content, homeHero(true));
    showSkeleton(seq, 4, true);
  }
  if (!homeLoaded || reload) void loadHome(seq);
}

async function loadInboxEntries(includeSpam: boolean): Promise<InboxEntry[]> {
  // Forms are content rows of the built-in `form` type; there is no
  // dedicated list endpoint. One row per locale, so de-duplicate by slug.
  const page = await api.listContent({ type: "form", status: "published,draft,review", limit: 100 });
  const seen: Record<string, boolean> = {};
  const forms: { slug: string; title: string }[] = [];
  for (let i = 0; i < page.data.length; i++) {
    const f = page.data[i];
    if (!f || seen[f.slug]) continue;
    seen[f.slug] = true;
    forms.push({ slug: f.slug, title: f.title });
  }
  cForms = forms;
  const lists = await Promise.all(
    forms.map((f) =>
      api
        .listSubmissions(f.slug, includeSpam)
        .then((subs) => subs.map((s) => ({ s, formSlug: f.slug, formTitle: f.title })))
        .catch(() => [] as InboxEntry[]),
    ),
  );
  const out: InboxEntry[] = [];
  for (let i = 0; i < lists.length; i++) {
    const l = lists[i];
    if (!l) continue;
    for (let k = 0; k < l.length; k++) {
      const e = l[k];
      if (e) out.push(e);
    }
  }
  out.sort((a, b) => (a.s.createdAt < b.s.createdAt ? 1 : a.s.createdAt > b.s.createdAt ? -1 : 0));
  return out;
}

async function loadHome(seq: number): Promise<void> {
  try {
    await ensureTypes();
  } catch (e) {
    if (isCurrent(seq)) fail(e);
    return;
  }
  const types = visibleTypes();
  const draftsP = Promise.all(
    types.map((t) =>
      api
        .listContent({ type: t.slug, status: "draft,review", limit: 50 })
        .then((p) => p)
        .catch(() => null),
    ),
  );
  const inboxP = loadInboxEntries(false).catch(() => null);
  const mediaP = api.listMedia(200).catch(() => null);
  const jobsP = can("manageJobs") ? api.jobStats().catch(() => null) : Promise.resolve(null);
  const pages = await draftsP;
  const inbox = await inboxP;
  const media = await mediaP;
  const stats = await jobsP;

  const drafts: ContentItem[] = [];
  let nDraft = 0;
  let nReview = 0;
  let capped = false;
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    if (!p) continue;
    if (p.pagination.hasMore) capped = true;
    for (let k = 0; k < p.data.length; k++) {
      const it = p.data[k];
      if (!it) continue;
      if (it.status === "review") nReview++;
      else nDraft++;
      drafts.push(it);
    }
  }
  drafts.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  hDrafts = drafts;
  hDraftCount = nDraft;
  hReviewCount = nReview;
  hDraftsCapped = capped;
  if (inbox) {
    cInbox = inbox;
    inboxLoaded = true;
    inboxSpam = false;
  }
  if (media) setMedia(media);
  hJobsBad = 0;
  if (stats) hJobsBad = (stats["failed"] ?? 0) + (stats["dead"] ?? 0);
  homeLoaded = true;
  if (isWide && me) paintSidebar(); // failed-jobs badge
  if (!isCurrent(seq)) return;
  widgetClearChildren(content);
  drawHome();
}

function newThisWeek(): number {
  const since = Date.now() - 7 * 86400000;
  let n = 0;
  for (let i = 0; i < cInbox.length; i++) {
    const e = cInbox[i];
    if (e && !e.s.isSpam && parseTime(e.s.createdAt) >= since) n++;
  }
  return n;
}

function homeHero(loading: boolean): Widget {
  const h = heroCard();
  const hero = h.inner;
  const top = hrow(12);
  put(top, softTile("globe", WHITE, [1, 1, 1, 0.2], 40, false));
  const tx = column(1);
  put(tx, text(tr("Your website"), 13, 600, [1, 1, 1, 0.82], 1));
  put(tx, text(hostOf(api.getBaseUrl()), 19, 700, WHITE, 1));
  put(top, grow(tx));
  add(hero, top);
  put(hero, gap(6));
  let summary = tr("Checking what needs your attention…");
  if (!loading) {
    const parts: string[] = [];
    const waiting = hDraftCount + hReviewCount;
    const n = `${waiting}${hDraftsCapped ? "+" : ""}`;
    if (waiting > 0) parts.push(waiting === 1 ? tr("{n} draft waiting", { n }) : tr("{n} drafts waiting", { n }));
    const fresh = newThisWeek();
    if (fresh > 0) parts.push(plural(fresh, "{n} new message this week", "{n} new messages this week"));
    summary = parts.length > 0 ? parts.join(" · ") : tr("Everything is published and your inbox is clear.");
  }
  add(hero, text(summary, 15, 500, [1, 1, 1, 0.95], 0));
  put(hero, gap(10));
  const visit = button(tr("Visit website"), "safari", B_ON_BRAND, 40, () => openURL(api.getBaseUrl()));
  const share = button(isDesktop ? tr("Copy link") : tr("Share"), isDesktop ? "link" : "square.and.arrow.up", B_GHOST_ON_BRAND, 40, () => {
    if (isDesktop) {
      clipboardWrite(api.getBaseUrl());
      setNotice(tr("Link copied"), 2);
    } else shareUrl(api.getBaseUrl(), siteName(api.getBaseUrl()));
  });
  if (isWide) {
    const r = hrow(10);
    widgetSetHugging(visit, 750);
    widgetSetHugging(share, 750);
    put(r, visit);
    put(r, share);
    put(r, Spacer());
    add(hero, r);
  } else {
    add(hero, buttonRow([visit, share]));
  }
  return h.outer;
}

/** Tiles in rows of `cols` equal columns. */
function tileGrid(tiles: Widget[], cols: number, spacing: number): Widget {
  const v = column(spacing);
  for (let i = 0; i < tiles.length; i += cols) {
    const r = HStack(spacing, []);
    stackSetDistribution(r, 1);
    for (let k = 0; k < cols; k++) {
      const t = tiles[i + k];
      put(r, t ? t : VStack(0, []));
    }
    add(v, r);
  }
  return v;
}
function statsGrid(tiles: Widget[]): Widget {
  return tileGrid(tiles, isWide ? 4 : 2, isWide ? 16 : 12);
}
/**
 * Two columns on desktop (main grows, side is fixed); stacked on phones and
 * iPad, where a fixed side column would squeeze the main one (an iPad
 * portrait window has ~700 pt next to the sidebar, less in Split View).
 */
function twoColumns(main: Widget, side: Widget, sideWidth: number): Widget {
  if (!isDesktop) {
    const v = column(14);
    add(v, main);
    add(v, side);
    return v;
  }
  // Trailing spacers keep NSStackView from spreading a shorter column's
  // children over the taller one's height.
  put(main, Spacer());
  put(side, Spacer());
  const r = HStack(24, []);
  stackSetAlignment(r, 3);
  put(r, grow(main));
  widgetSetWidth(side, sideWidth);
  put(r, side);
  return r;
}

/** Content types the user can create, routable ones (pages, posts) first. */
function creatableTypes(): ContentType[] {
  const out: ContentType[] = [];
  const rest: ContentType[] = [];
  for (let i = 0; i < cTypes.length; i++) {
    const t = cTypes[i];
    if (!t || !canType(t.slug, "create")) continue;
    if (t.isRoutable) out.push(t);
    else rest.push(t);
  }
  return out.concat(rest);
}

function startNewItem(t: ContentType): void {
  selType = t;
  newTitle = "";
  newSlug = "";
  newSlugTouched = false;
  newLocale = defaultLocale;
  go(R_NEW);
}

function quickAction(icon: string, tint: Rgba, label: string, run: () => void): Widget {
  const c = card(14, 10);
  put(c, softTile(icon, tint, tintFill(tint), 34, false));
  add(c, text(label, 14, 600, INK, 2));
  onTap(c, run);
  return c;
}

function drawHome(): void {
  add(content, homeHero(false));

  const tiles: Widget[] = [];
  const waiting = hDraftCount;
  tiles.push(
    statTile("pencil.line", TILE_ORANGE, `${waiting}${hDraftsCapped ? "+" : ""}`, tr("Drafts"), () => {
      switchTab(1);
    }),
  );
  tiles.push(statTile("eye", TILE_PURPLE, String(hReviewCount), tr("In review"), () => switchTab(1)));
  tiles.push(statTile("tray.full", TILE_BLUE, String(newThisWeek()), tr("New messages"), () => switchTab(3)));
  tiles.push(statTile("photo.on.rectangle", TILE_GREEN, String(cMedia.length), tr("Media files"), () => switchTab(2)));
  add(content, statsGrid(tiles));

  if (hJobsBad > 0) {
    const b = banner(K_DANGER, "exclamationmark.triangle.fill", plural(hJobsBad, "{n} background job failed. Tap to review.", "{n} background jobs failed. Tap to review."));
    onTap(b, () => go(R_JOBS));
    add(content, b);
  }

  const creatable = creatableTypes();
  const quick: Widget[] = [];
  for (let i = 0; i < creatable.length && quick.length < 2; i++) {
    const t = creatable[i];
    if (!t) continue;
    const c = typeColor(t.slug);
    quick.push(quickAction(typeSymbol(t, t.slug), c, tr("New {type}", { type: t.labelSingular }), () => startNewItem(t)));
  }
  if (can("manageMedia")) quick.push(quickAction("camera", TILE_GREEN, tr("Upload photo"), () => startUpload()));
  if (quick.length > 0) {
    add(content, sectionHeader(tr("Quick actions"), "", null));
    const r = HStack(12, []);
    stackSetDistribution(r, 1);
    for (let i = 0; i < quick.length; i++) {
      const q = quick[i];
      if (q) put(r, q);
    }
    add(content, r);
  }

  const left = column(14);
  const right = column(14);
  add(
    left,
    sectionHeader(tr("Continue editing"), tr("All content"), () => {
      switchTab(1);
    }),
  );
  if (hDrafts.length === 0) {
    const c = card(16, 0);
    const r = hrow(12);
    put(r, softTile("checkmark", OK_FG, tintFill(TILE_GREEN), 38, true));
    const tx = column(2);
    put(tx, text(tr("All caught up"), 16, 600, INK, 1));
    add(tx, caption(tr("No drafts are waiting to be published.")));
    put(r, grow(tx));
    add(c, r);
    add(left, c);
  } else {
    const rows: Widget[] = [];
    for (let i = 0; i < hDrafts.length && i < 5; i++) {
      const it = hDrafts[i];
      if (!it) continue;
      const t = typeBySlug(it.type);
      const kind = t ? t.labelSingular : it.type;
      rows.push(item(contentLead(it, 42), it.title, `${statusWord(it.status)} · ${kind} · ${relTime(it.updatedAt)}`, null, true, () => openEditor(it)));
    }
    add(left, group(rows, 70));
  }

  if (cForms.length > 0) {
    add(
      right,
      sectionHeader(tr("Latest messages"), tr("Inbox"), () => {
        switchTab(3);
      }),
    );
    const rows: Widget[] = [];
    for (let i = 0; i < cInbox.length && rows.length < 3; i++) {
      const e = cInbox[i];
      if (e && !e.s.isSpam) rows.push(inboxRow(e));
    }
    if (rows.length === 0) {
      const c = card(16, 0);
      add(c, caption(tr("No messages yet. Form submissions from your website appear here.")));
      add(right, c);
    } else {
      add(right, group(rows, 68));
    }
  }
  if (cForms.length > 0) add(content, twoColumns(left, right, 380));
  else add(content, left);
}

// ---------- content: types ----------------------------------------------

function screenTypes(seq: number, reload: boolean): void {
  setLargeHeader("", tr("Content"), []);
  if (cTypesLoaded) drawTypes();
  else showSkeleton(seq, 6, true);
  if (!cTypesLoaded || reload) {
    void (async () => {
      try {
        cTypesLoaded = false;
        await ensureTypes();
      } catch (e) {
        if (isCurrent(seq)) fail(e);
        return;
      }
      if (!isCurrent(seq)) return;
      widgetClearChildren(content);
      drawTypes();
    })();
  }
}

function typeRow(t: ContentType): Widget {
  const c = typeColor(t.slug);
  const sub = t.isRoutable && t.urlPattern ? t.urlPattern.replace(":slug", "…") : "";
  return item(iconTile(typeSymbol(t, t.slug), c, 34), t.labelPlural, sub, null, true, () => openType(t));
}

function drawTypes(): void {
  const types = visibleTypes();
  if (types.length === 0) {
    add(content, emptyState("square.stack", tr("No content types yet"), tr("A developer defines content types in the CMS. They show up here once they exist."), "", null));
    return;
  }
  const pages: Widget[] = [];
  const data: Widget[] = [];
  for (let i = 0; i < types.length; i++) {
    const t = types[i];
    if (!t) continue;
    if (t.isRoutable) pages.push(typeRow(t));
    else data.push(typeRow(t));
  }
  if (pages.length > 0) {
    add(content, groupLabel(tr("Pages & posts")));
    add(content, group(pages, 62));
  }
  if (data.length > 0) {
    add(content, groupLabel(tr("Collections")));
    add(content, group(data, 62));
  }
}

function openType(t: ContentType): void {
  selType = t;
  contentStatus = 0;
  contentFilter = "";
  contentLocale = siteLocales.length > 1 ? defaultLocale : "";
  cContent = [];
  cContentCursor = null;
  cContentHasMore = false;
  go(R_CONTENT);
}

// ---------- content: list -----------------------------------------------

function screenContent(seq: number, reload: boolean): void {
  const t = selType;
  if (!t) {
    leave();
    return;
  }
  const allowCreate = canType(t.slug, "create");
  setBarHeader(t.labelPlural, allowCreate ? [headerAction("plus", tr("New {type}", { type: t.labelSingular }), () => startNewItem(t))] : []);

  const search = searchField(tr("Search {types}", { types: noun(t.labelPlural) }), contentFilter, (s: string) => {
    contentFilter = s;
    drawContentRows();
  });
  const statusSeg = segmented(STATUS_LABELS, contentStatus, (i: number) => {
    contentStatus = i;
    reloadContentList();
  });
  let localeSeg: Widget | null = null;
  if (siteLocales.length > 1) {
    const labels = localeLabels();
    const at = siteLocales.indexOf(contentLocale);
    const onPick = (i: number): void => {
      contentLocale = siteLocales[i] ?? "";
      reloadContentList();
    };
    localeSeg = labels.length <= 5 ? segmented(labels, at, onPick) : chips(labels, [at], false, (sel: number[]) => onPick(sel[0] ?? 0));
  }
  if (isWide) {
    // One toolbar row: search | status | language.
    const bar = hrow(12);
    put(bar, grow(search));
    widgetSetWidth(statusSeg, 380);
    put(bar, statusSeg);
    if (localeSeg) {
      widgetSetWidth(localeSeg, 44 * siteLocales.length + 20);
      put(bar, localeSeg);
    }
    add(content, bar);
  } else {
    add(content, search);
    add(content, statusSeg);
    if (localeSeg) add(content, localeSeg);
  }

  const box = column(10);
  contentListBox = box;
  add(content, box);

  const needsLoad = reload || contentStale || cContent.length === 0;
  if (!needsLoad) {
    drawContentRows();
    return;
  }
  contentStale = false;
  add(box, skeletonList(6, true, alive(seq)));
  void loadContent(seq, false);
}

/** Status/locale changed: refetch without rebuilding the controls. */
function reloadContentList(): void {
  const box = contentListBox;
  if (!box) return;
  renderSeq++;
  const seq = renderSeq;
  widgetClearChildren(box);
  add(box, skeletonList(6, true, alive(seq)));
  cContent = [];
  void loadContent(seq, false);
}

async function loadContent(seq: number, more: boolean): Promise<void> {
  const t = selType;
  if (!t) return;
  if (!mediaLoaded) {
    try {
      await ensureMedia();
    } catch {
      // thumbnails are optional
    }
  }
  try {
    const page = await api.listContent({
      type: t.slug,
      status: STATUS_KEYS[contentStatus] ?? "published",
      locale: contentLocale.length > 0 ? contentLocale : undefined,
      limit: 50,
      cursor: more && cContentCursor ? cContentCursor : undefined,
    });
    if (!isCurrent(seq)) return;
    if (more) {
      for (let i = 0; i < page.data.length; i++) {
        const it = page.data[i];
        if (it) cContent.push(it);
      }
    } else {
      cContent = page.data;
    }
    cContentCursor = page.pagination.nextCursor;
    cContentHasMore = page.pagination.hasMore && !!page.pagination.nextCursor && page.data.length > 0;
  } catch (e) {
    if (isCurrent(seq)) {
      fail(e);
      drawContentRows();
    }
    return;
  }
  drawContentRows();
}

function drawContentRows(): void {
  const box = contentListBox;
  const t = selType;
  if (!box || !t || currentRoute() !== R_CONTENT) return;
  widgetClearChildren(box);
  const needle = contentFilter.trim().toLowerCase();
  const rows: Widget[] = [];
  for (let i = 0; i < cContent.length; i++) {
    const it = cContent[i];
    if (!it) continue;
    if (needle.length > 0 && it.title.toLowerCase().indexOf(needle) < 0 && it.slug.toLowerCase().indexOf(needle) < 0) continue;
    const showLocale = siteLocales.length > 1 && contentLocale.length === 0;
    rows.push(item(contentLead(it, 44), it.title, `/${it.slug} · ${relTime(it.updatedAt)}`, showLocale ? tag(it.locale.toUpperCase()) : null, true, () => openEditor(it)));
  }
  if (cContentHasMore && needle.length === 0) {
    rows.push(
      actionItem(null, tr("Load more"), BRAND_INK, () => {
        setNotice(tr("Loading more…"), 0);
        const seq = renderSeq;
        void loadContent(seq, true).then(() => {
          if (isCurrent(seq)) setNotice("", 0);
        });
      }),
    );
  }
  if (rows.length === 0) {
    if (needle.length > 0) {
      add(box, emptyState("magnifyingglass", tr("No matches"), tr("Nothing in {types} matches “{q}”.", { types: t.labelPlural, q: contentFilter.trim() }), "", null));
      return;
    }
    const allowCreate = canType(t.slug, "create");
    const types = noun(t.labelPlural);
    const titles = [tr("No live {types}", { types }), tr("No draft {types}", { types }), tr("No {types} in review", { types }), tr("No archived {types}", { types })];
    const msgs = [
      tr("Nothing is live yet. Publish a draft and it appears here."),
      tr("Drafts you create or save appear here."),
      tr("Items submitted for review appear here."),
      tr("Archived items appear here and can still be opened."),
    ];
    add(
      box,
      emptyState(typeSymbol(t, t.slug), titles[contentStatus] ?? "", msgs[contentStatus] ?? "", allowCreate ? tr("New {type}", { type: t.labelSingular }) : "", allowCreate ? () => startNewItem(t) : null),
    );
    return;
  }
  add(box, group(rows, 74));
  if (cContent.length > 0) add(box, footnote(cContentHasMore ? tr("{n} items so far", { n: cContent.length }) : plural(cContent.length, "{n} item", "{n} items")));
}

// ---------- content: new item -------------------------------------------

let newTitle = "";
let newSlug = "";
let newSlugTouched = false;
let newLocale = "";
let newBusy = false;

function pathFor(t: ContentType | null, slug: string): string {
  const s = slug.length > 0 ? slug : "…";
  if (t && t.urlPattern) return t.urlPattern.replace(":slug", s);
  return `/${s}`;
}

function screenNewItem(): void {
  const t = selType;
  if (!t) {
    leave();
    return;
  }
  setBarHeader(tr("New {type}", { type: t.labelSingular }), []);
  const head = hrow(12);
  put(head, typeTile(t.slug, 44));
  const tx = column(2);
  put(tx, text(tr("New {type}", { type: t.labelSingular }), 18, 700, INK, 1));
  add(tx, caption(tr("Starts as a draft. Nothing goes live until you publish.")));
  put(head, grow(tx));
  setPadding(head, 4, 2, 4, 2);
  add(content, head);

  const form = card(16, 16);
  const addr = text(t.isRoutable ? tr("Address: {path}", { path: pathFor(t, newSlugTouched ? newSlug : slugify(newTitle)) }) : "", 13, 400, MUTED, 1);
  add(
    form,
    field(
      tr("Title"),
      null,
      input(tr("Title"), newTitle, false, "", (s: string) => {
        newTitle = s;
        if (!newSlugTouched) newSlug = slugify(s);
        if (t.isRoutable) textSetString(addr, tr("Address: {path}", { path: pathFor(t, newSlugTouched ? newSlug : slugify(s)) }));
      }),
      "",
    ),
  );
  add(
    form,
    field(
      tr("URL slug"),
      null,
      input(tr("made-from-the-title"), newSlugTouched ? newSlug : "", false, "link", (s: string) => {
        newSlug = s;
        newSlugTouched = s.length > 0;
        if (t.isRoutable) textSetString(addr, tr("Address: {path}", { path: pathFor(t, newSlugTouched ? slugify(s) : slugify(newTitle)) }));
      }),
      tr("Leave empty to build it from the title."),
    ),
  );
  if (t.isRoutable) add(form, addr);
  if (siteLocales.length > 1) {
    add(
      form,
      field(
        tr("Language"),
        null,
        segmented(localeLabels(), siteLocales.indexOf(newLocale), (i: number) => {
          newLocale = siteLocales[i] ?? defaultLocale;
        }),
        "",
      ),
    );
  }
  add(content, form);
  setActions([
    button(newBusy ? tr("Creating…") : tr("Create draft"), "plus", B_PRIMARY, AB_H, () => {
      void doCreateItem();
    }),
  ]);
}

async function doCreateItem(): Promise<void> {
  const t = selType;
  if (!t || newBusy) return;
  const title = newTitle.trim();
  const slug = slugify(newSlug.length > 0 ? newSlug : title);
  if (title.length === 0 || slug.length === 0) {
    setNotice(tr("Give it a title first."), 1);
    return;
  }
  newBusy = true;
  setNotice(tr("Creating draft…"), 0);
  try {
    const it = await api.createContent({ type: t.slug, slug, locale: newLocale.length > 0 ? newLocale : defaultLocale, title });
    newBusy = false;
    contentStale = true;
    homeLoaded = false;
    contentStatus = 1;
    navStack.pop();
    navTitles.pop();
    navOffsets.pop();
    openEditor(it);
    haptic("success");
  } catch (e) {
    newBusy = false;
    fail(e);
  }
}

// ---------- content: editor ---------------------------------------------

let edItem: ContentItem | null = null;
let edType: ContentType | null = null;
let edTitle = "";
let edSlug = "";
let edValues: Record<string, unknown> = {};
/** Text buffers for fields edited as text but stored as number/JSON. */
let edRaw: Record<string, string> = {};
let edSeoTitle = "";
let edSeoDesc = "";
let edDirty = false;
let edBusy = false;
let edStateLabel: Widget | null = null;
let seoPrevTitle: Widget | null = null;
let seoPrevDesc: Widget | null = null;
let seoTitleCounter: Widget | null = null;
let seoDescCounter: Widget | null = null;
let titleCounter: Widget | null = null;

const GOOGLE_BLUE: Rgba = dark ? [0.541, 0.706, 0.973, 1] : [0.102, 0.051, 0.671, 1];

/** Field types edited as raw JSON because they hold structured values. */
function isJsonField(def: FieldDef): boolean {
  const t = def.type;
  return t === "repeater" || t === "relation" || t === "gallery" || t === "json";
}
function isLongText(def: FieldDef): boolean {
  return def.type === "textarea" || def.type === "richtext";
}

function loadEditorBuffers(it: ContentItem): void {
  // A different item gets fresh Markdown editors; a reload of the same one
  // (after saving) keeps them, with their caret and undo history.
  if (it.id !== mdItemId) {
    resetMarkdownEditors();
    mdItemId = it.id;
  }
  edItem = it;
  edType = typeBySlug(it.type);
  edTitle = it.title;
  edSlug = it.slug;
  edValues = {};
  edRaw = {};
  for (const key in it.fields) edValues[key] = it.fields[key];
  const defs = edType ? edType.fieldsSchema.fields : [];
  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    if (!def) continue;
    const v = edValues[def.name];
    if (isJsonField(def)) edRaw[def.name] = v === null || v === undefined ? "" : prettyJson(v);
    else if (def.type === "number") edRaw[def.name] = v === null || v === undefined ? "" : String(v);
  }
  edSeoTitle = plain(it.seo["metaTitle"]);
  edSeoDesc = plain(it.seo["metaDescription"]);
  edDirty = false;
}

function openEditor(it: ContentItem): void {
  loadEditorBuffers(it);
  go(R_EDITOR);
}

function touch(): void {
  if (edDirty) return;
  edDirty = true;
  const l = edStateLabel;
  if (l) {
    textSetString(l, tr("Unsaved changes"));
    color(l, WARN_FG);
  }
}

function refreshSeoPreview(): void {
  const title = edSeoTitle.trim().length > 0 ? edSeoTitle.trim() : edTitle.trim();
  if (seoPrevTitle) textSetString(seoPrevTitle, title.length > 0 ? title : tr("Page title"));
  if (seoPrevDesc) textSetString(seoPrevDesc, edSeoDesc.trim().length > 0 ? edSeoDesc.trim() : tr("Add a meta description so search engines show a helpful summary of this page."));
  if (seoTitleCounter) setCounter(seoTitleCounter, edSeoTitle.trim().length, 1, 70);
  if (seoDescCounter) setCounter(seoDescCounter, edSeoDesc.trim().length, 70, 160);
  if (titleCounter) setCounter(titleCounter, edTitle.trim().length, 1, 70);
}

function publicUrl(it: ContentItem): string {
  if (!it.url) return "";
  if (/^https?:\/\//i.test(it.url)) return it.url;
  return `${api.getBaseUrl()}${it.url.indexOf("/") === 0 ? "" : "/"}${it.url}`;
}

function editorMenu(it: ContentItem): void {
  const labels: string[] = [];
  const handlers: (() => void)[] = [];
  const url = publicUrl(it);
  if (url.length > 0 && it.status === "published") {
    labels.push(tr("View on website"));
    handlers.push(() => openURL(url));
    labels.push(tr("Share link"));
    handlers.push(() => shareUrl(url, it.title));
    labels.push(tr("Copy link"));
    handlers.push(() => {
      clipboardWrite(url);
      setNotice(tr("Link copied"), 2);
    });
  }
  if (canType(it.type, "publish") && it.status === "published") {
    labels.push(tr("Unpublish"));
    handlers.push(() =>
      confirm(tr("Unpublish?"), tr("It is taken off the live site and becomes a draft again."), tr("Unpublish"), () => {
        void doUnpublish();
      }),
    );
  }
  const allowEdit = canType(it.type, "update") || canType(it.type, "updateOwn");
  if (allowEdit && it.status !== "archived") {
    labels.push(tr("Archive"));
    handlers.push(() =>
      confirm(tr("Archive this item?"), tr("It is removed from the live site and moved to Archived, where it can still be opened."), tr("Archive"), () => {
        void doDelete(false);
      }),
    );
  }
  if (canType(it.type, "delete")) {
    labels.push(tr("Delete permanently"));
    handlers.push(() =>
      confirm(tr("Delete permanently?"), tr("“{title}” will be removed for good. This can't be undone.", { title: it.title }), tr("Delete"), () => {
        void doDelete(true);
      }),
    );
  }
  if (labels.length === 0) return;
  actionMenu(it.title, labels, handlers);
}

function screenEditor(): void {
  const it = edItem;
  if (!it) {
    leave();
    return;
  }
  const t = edType;
  const allowEdit = canType(it.type, "update") || canType(it.type, "updateOwn");
  const allowPublish = canType(it.type, "publish");
  setBarHeader(t ? t.labelSingular : it.type, [headerAction("ellipsis.circle", tr("More"), () => editorMenu(it))]);

  // Summary
  const sum = card(16, 10);
  const top = hrow(8);
  put(top, statusPill(it.status));
  if (siteLocales.length > 1) put(top, tag(it.locale.toUpperCase()));
  put(top, Spacer());
  const state = text(edDirty ? tr("Unsaved changes") : tr("Edited {when}", { when: relTimeInline(it.updatedAt) }), 13, 500, edDirty ? WARN_FG : MUTED, 1);
  edStateLabel = state;
  put(top, state);
  add(sum, top);
  add(sum, title2(it.title.length > 0 ? it.title : tr("Untitled")));
  const url = publicUrl(it);
  if (url.length > 0) {
    const link = hrow(6);
    put(link, symbol(it.status === "published" ? "globe" : "eye.slash", 14, it.status === "published" ? BRAND_INK : MUTED));
    put(link, grow(text(it.status === "published" ? hostOf(url) + (it.url ?? "") : `${it.url ?? ""} · ${tr("not live")}`, 14, 500, it.status === "published" ? BRAND_INK : MUTED, 1)));
    if (it.status === "published") onTap(link, () => openURL(url));
    add(sum, link);
  }
  const mainCol = column(14);
  const sideCol = column(14);
  if (isDesktop) add(sideCol, sum);
  else add(mainCol, sum);

  // Basics
  add(mainCol, groupLabel(tr("Basics")));
  const basics = card(16, 16);
  const tc = counter();
  titleCounter = tc;
  add(
    basics,
    field(
      tr("Title"),
      tc,
      input(tr("Title"), edTitle, false, "", (s: string) => {
        edTitle = s;
        touch();
        refreshSeoPreview();
      }),
      "",
    ),
  );
  add(
    basics,
    field(
      tr("URL slug"),
      null,
      input("slug", edSlug, false, "link", (s: string) => {
        edSlug = s;
        touch();
      }),
      t && t.isRoutable ? tr("Address: {path}", { path: pathFor(t, edSlug) }) : "",
    ),
  );
  add(mainCol, basics);

  // Schema fields
  const defs = t ? t.fieldsSchema.fields : [];
  if (defs.length > 0) {
    add(mainCol, groupLabel(tr("Content")));
    const fields = card(16, 20);
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i];
      if (def) add(fields, fieldEditor(def));
    }
    add(mainCol, fields);
  } else if (!t) {
    add(mainCol, banner(K_WARN, "exclamationmark.triangle.fill", tr("This item's content type couldn't be loaded, so only its title and slug can be edited here.")));
  }

  // SEO
  add(sideCol, groupLabel(tr("Search engine listing")));
  const seo = card(16, 16);
  const prev = column(4);
  bg(prev, SURFACE2);
  setCornerRadius(prev, 12);
  setPadding(prev, 14, 14, 14, 14);
  const site = hrow(8);
  put(site, softTile("globe", MUTED, SURFACE3, 24, true));
  const st = column(0);
  put(st, text(siteName(api.getBaseUrl()), 12, 600, INK, 1));
  put(st, text(`${hostOf(api.getBaseUrl())}${t ? pathFor(t, edSlug) : ""}`, 12, 400, MUTED, 1));
  put(site, grow(st));
  add(prev, site);
  put(prev, gap(4));
  const pt = text("", 18, 400, GOOGLE_BLUE, 2);
  const pd = text("", 14, 400, BODY, 3);
  seoPrevTitle = pt;
  seoPrevDesc = pd;
  add(prev, pt);
  add(prev, pd);
  add(seo, prev);
  const stc = counter();
  seoTitleCounter = stc;
  add(
    seo,
    field(
      tr("Meta title"),
      stc,
      input(tr("Defaults to the title"), edSeoTitle, false, "", (s: string) => {
        edSeoTitle = s;
        touch();
        refreshSeoPreview();
      }),
      "",
    ),
  );
  const sdc = counter();
  seoDescCounter = sdc;
  add(
    seo,
    field(
      tr("Meta description"),
      sdc,
      textArea(edSeoDesc, 104, (s: string) => {
        edSeoDesc = s;
        touch();
        refreshSeoPreview();
      }),
      tr("Publishing needs 70–160 characters."),
    ),
  );
  add(sideCol, seo);
  refreshSeoPreview();
  add(content, twoColumns(mainCol, sideCol, 380));

  // Actions
  const actions: Widget[] = [];
  if (allowEdit) {
    if (allowPublish && it.status !== "published") {
      actions.push(button(tr("Save"), "", B_SECONDARY, AB_H, () => void doSave(false)));
      actions.push(button(tr("Publish"), "paperplane.fill", B_PRIMARY, AB_H, () => void doSave(true)));
    } else {
      actions.push(button(it.status === "published" ? tr("Save changes") : tr("Save"), "", B_PRIMARY, AB_H, () => void doSave(false)));
    }
  } else if (allowPublish && it.status !== "published") {
    actions.push(button(tr("Publish"), "paperplane.fill", B_PRIMARY, AB_H, () => void doSave(true)));
  }
  if (actions.length > 0) setActions(actions);
}

/** Media ids from a gallery buffer, or null when it isn't a plain id list. */
function galleryIds(raw: string): number[] | null {
  const s = raw.trim();
  if (s.length === 0) return [];
  try {
    const v = JSON.parse(s) as unknown;
    if (!Array.isArray(v)) return null;
    const out: number[] = [];
    for (let i = 0; i < v.length; i++) {
      const n = v[i];
      if (typeof n !== "number") return null;
      out.push(n);
    }
    return out;
  } catch {
    return null;
  }
}

/** Re-render the editor but keep the scroll position. */
function redrawEditor(): void {
  const y = scrollviewGetOffset(scroll);
  render(false);
  if (y > 0) setTimeout(() => scrollviewSetOffset(scroll, 0, y), 40);
}

function pickImageFor(name: string, append: boolean): void {
  pickField = name;
  pickAppend = append;
  pickMarkdown = false;
  go(R_MEDIA);
}

// ---------- Markdown fields (@skelpo/markdown-editor) ---------------------
//
// Rich-text fields are Markdown. Phone: the field is a preview card that opens
// the full-screen Write screen. Desktop: the editor sits inline under a
// formatting bar. One native editor per field of the open item, kept across
// redraws so the caret, selection and undo history survive (including a trip
// to the image picker).

let mdEditors: Record<string, MarkdownEditor> = {};
let mdItemId = -1;
let mdWordLabels: Record<string, Widget> = {};
let pickMarkdown = false;
let wrField = "";
let wrTitle = "";
let wrPreview = false;

const MD_TOOLBAR = ["h2", "h3", "bold", "italic", "link", "action:photo:1", "bullet", "numbered", "quote", "code", "strike", "task", "rule", "undo", "redo"];

function resetMarkdownEditors(): void {
  for (const k in mdEditors) {
    const e = mdEditors[k];
    if (e) destroyEditor(e);
  }
  mdEditors = {};
  mdWordLabels = {};
}

function wordsLine(n: number): string {
  if (n === 0) return tr("Empty");
  return `${plural(n, "{n} word", "{n} words")} · ${tr("{n} min read", { n: Math.max(1, Math.round(n / 200)) })}`;
}

function updateWordLabel(name: string): void {
  const e = mdEditors[name];
  const l = mdWordLabels[name];
  if (e && l) textSetString(l, wordsLine(wordCount(e)));
}

function mdEditorFor(name: string): MarkdownEditor {
  const have = mdEditors[name];
  if (have) return have;
  const v = edValues[name];
  const ed = markdownEditor({
    text: typeof v === "string" ? v : "",
    placeholder: tr("Start writing… Markdown works: # heading, **bold**, - list"),
    fontSize: isDesktop ? 15 : 17,
    accent: [BRAND_INK[0], BRAND_INK[1], BRAND_INK[2]],
    toolbar: MD_TOOLBAR,
    onChange: () => {
      const e = mdEditors[name];
      if (!e) return;
      edValues[name] = getMarkdown(e);
      touch();
      updateWordLabel(name);
    },
    onAction: (code: number) => {
      if (code === 1) pickImageForMarkdown(name);
    },
  });
  mdEditors[name] = ed;
  return ed;
}

function pickImageForMarkdown(name: string): void {
  pickField = name;
  pickAppend = false;
  pickMarkdown = true;
  go(R_MEDIA);
}

/** First lines of the Markdown with markers stripped, for the phone card. */
function markdownExcerpt(md: string): string {
  const out: string[] = [];
  const lines = md.split("\n");
  let fence = false;
  for (let i = 0; i < lines.length && out.length < 3; i++) {
    let l = (lines[i] ?? "").trim();
    if (l.startsWith("```")) {
      fence = !fence;
      continue;
    }
    if (fence || l.length === 0 || l.startsWith("![")) continue;
    l = l.replace(/^#{1,6}\s+/, "").replace(/^>\s?/, "").replace(/^([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?/, "");
    l = l.replace(/\*\*|__|~~|`/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
    if (l.length > 0) out.push(l);
  }
  return out.join(" ");
}

function markdownField(name: string, title: string, help: string): Widget {
  const ed = mdEditorFor(name);
  const words = caption(wordsLine(wordCount(ed)));
  mdWordLabels[name] = words;

  if (isWide) {
    const box = column(0);
    bg(box, SURFACE2);
    setCornerRadius(box, 12);
    const bar = hrow(2);
    setPadding(bar, 5, 8, 5, 8);
    const tb = (icon: string, label: string, cmd: number): void => {
      put(bar, toolButton(icon, label, BODY, () => runFormat(ed, cmd)));
    };
    tb("", "H2", Format.Heading2);
    tb("", "H3", Format.Heading3);
    tb("bold", "", Format.Bold);
    tb("italic", "", Format.Italic);
    tb("strikethrough", "", Format.Strikethrough);
    tb("link", "", Format.Link);
    put(bar, toolButton("photo", "", BODY, () => pickImageForMarkdown(name)));
    tb("list.bullet", "", Format.BulletList);
    tb("list.number", "", Format.NumberedList);
    tb("text.quote", "", Format.Quote);
    tb("chevron.left.forwardslash.chevron.right", "", Format.InlineCode);
    put(bar, Spacer());
    put(bar, words);
    add(box, bar);
    add(box, divider(0));
    widgetSetHeight(ed.widget, 480);
    add(box, ed.widget);
    return field(title, tag("MARKDOWN"), box, help.length > 0 ? help : tr("⌘B bold · ⌘I italic · ⌘K link"));
  }

  const v = edValues[name];
  const md = typeof v === "string" ? v : "";
  const c = card(14, 8);
  const ex = markdownExcerpt(md);
  add(c, text(ex.length > 0 ? ex : tr("Tap to start writing"), 15, 400, ex.length > 0 ? BODY : FAINT, 3));
  const foot = hrow(6);
  put(foot, symbol("square.and.pencil", 14, BRAND_INK));
  put(foot, grow(text(ex.length > 0 ? tr("Edit") : tr("Write"), 14, 600, BRAND_INK, 1)));
  put(foot, words);
  add(c, foot);
  onTap(c, () => openWriter(name, title));
  return field(title, tag("MARKDOWN"), c, help);
}

function openWriter(name: string, title: string): void {
  wrField = name;
  wrTitle = title.replace(/ \*$/, "");
  wrPreview = false;
  go(R_WRITE);
}

/** Phone: full-screen Markdown editor for one field (writePane, not the ScrollView). */
function screenWrite(): void {
  const ed = mdEditors[wrField];
  if (!ed || !edItem) {
    leave();
    return;
  }
  setBarHeader(wrTitle, [
    headerAction(wrPreview ? "pencil" : "eye", wrPreview ? tr("Edit") : tr("Preview"), () => {
      wrPreview = !wrPreview;
      setPreview(ed, wrPreview);
      render(false);
    }),
  ]);
  setPreview(ed, wrPreview);
  widgetClearChildren(writePane);
  widgetSetHugging(ed.widget, 1);
  add(writePane, ed.widget);
  const status = hrow(8);
  setPadding(status, 6, GUTTER, 8, GUTTER);
  const words = caption(wordsLine(wordCount(ed)));
  mdWordLabels[wrField] = words;
  put(status, words);
  put(status, Spacer());
  put(status, caption(wrPreview ? tr("Preview") : "Markdown"));
  add(writePane, divider(0));
  add(writePane, status);
  if (!wrPreview && getMarkdown(ed).length === 0) setTimeout(() => focusEditor(ed), 350);
}

/** One schema field's editing widget. Its own function so each closure keeps its `def`. */
function fieldEditor(def: FieldDef): Widget {
  const name = def.name;
  const title = (def.label && def.label.length > 0 ? def.label : name) + (def.required ? " *" : "");
  const help = def.admin && def.admin.help ? def.admin.help : "";
  const value = edValues[name];

  if (def.type === "boolean") {
    const v = column(4);
    const r = hrow(12);
    put(r, grow(text(title, 15, 500, INK, 2)));
    const tg = Toggle("", (on: boolean) => {
      edValues[name] = on;
      touch();
    });
    toggleSetState(tg, value === true ? 1 : 0);
    put(r, tg);
    add(v, r);
    if (help.length > 0) add(v, caption(help));
    return v;
  }
  if (def.type === "select") {
    const options = def.validation && def.validation.options ? def.validation.options : [];
    const labels: string[] = [];
    if (!def.required) labels.push(tr("None"));
    for (let i = 0; i < options.length; i++) labels.push(options[i] ?? "");
    const offset = def.required ? 0 : 1;
    const current = typeof value === "string" ? options.indexOf(value) : -1;
    const sel = current >= 0 ? current + offset : def.required ? -1 : 0;
    return field(
      title,
      null,
      chips(labels, sel >= 0 ? [sel] : [], false, (s: number[]) => {
        const i = s[0] ?? 0;
        edValues[name] = i < offset ? null : (options[i - offset] ?? null);
        touch();
      }),
      help,
    );
  }
  if (def.type === "multiselect") {
    const options = def.validation && def.validation.options ? def.validation.options : [];
    const chosen: number[] = [];
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const v = value[i];
        const at = typeof v === "string" ? options.indexOf(v) : -1;
        if (at >= 0) chosen.push(at);
      }
    }
    return field(
      title,
      null,
      chips(options, chosen, true, (s: number[]) => {
        const next: string[] = [];
        for (let i = 0; i < options.length; i++) if (s.indexOf(i) >= 0) next.push(options[i] ?? "");
        edValues[name] = next;
        touch();
      }),
      help,
    );
  }
  if (def.type === "image") {
    const v = column(8);
    const id = typeof value === "number" ? value : 0;
    if (id > 0) {
      const img = Image(api.mediaRawUrl(id), "");
      widgetSetHeight(img, 200);
      bg(img, SURFACE2);
      setCornerRadius(img, 12);
      add(v, img);
      add(
        v,
        buttonRow([
          button(tr("Replace"), "photo", B_TINTED, 40, () => pickImageFor(name, false)),
          button(tr("Remove"), "trash", B_DANGER, 40, () => {
            edValues[name] = null;
            touch();
            redrawEditor();
          }),
        ]),
      );
    } else {
      const ph = centerColumn(8);
      bg(ph, SURFACE2);
      setCornerRadius(ph, 12);
      setPadding(ph, 28, 16, 28, 16);
      put(ph, symbol("photo.badge.plus", 30, MUTED));
      put(ph, text(tr("Choose from library"), 14, 600, BODY, 1));
      onTap(ph, () => pickImageFor(name, false));
      add(v, ph);
    }
    return field(title, null, v, help);
  }
  if (def.type === "gallery") {
    const ids = galleryIds(edRaw[name] ?? "");
    if (ids) {
      const v = column(10);
      const strip = HStack(8, []);
      const rows = column(8);
      let count = 0;
      for (let i = 0; i < ids.length; i++) {
        const mid = ids[i] ?? 0;
        const index = i;
        const th = mediaThumb(mid, 72) ?? softTile("doc", MUTED, SURFACE2, 72, false);
        onTap(th, () => {
          confirm(tr("Remove from gallery?"), tr("The file stays in the media library."), tr("Remove"), () => {
            const next = ids.slice(0);
            next.splice(index, 1);
            edRaw[name] = prettyJson(next);
            touch();
            redrawEditor();
          });
        });
        put(strip, th);
        count++;
        if (count % 4 === 0) {
          put(strip, Spacer());
          add(rows, strip);
        }
      }
      add(rows, strip);
      if (ids.length > 0) add(v, rows);
      add(v, button(ids.length > 0 ? tr("Add image") : tr("Add images from library"), "plus", B_TINTED, 40, () => pickImageFor(name, true)));
      return field(`${title}${ids.length > 0 ? ` · ${ids.length}` : ""}`, null, v, help.length > 0 ? help : ids.length > 0 ? tr("Tap an image to remove it.") : "");
    }
  }
  if (isJsonField(def)) {
    const hint =
      def.type === "relation"
        ? def.relation
          ? tr("IDs of linked {type} entries, e.g. [5].", { type: def.relation.toType })
          : tr("IDs of linked entries, e.g. [5].")
        : def.type === "gallery"
          ? tr("A list of media ids, e.g. [12, 15].")
          : tr("Structured data, edited as JSON.");
    return field(
      title,
      tag("JSON"),
      textArea(edRaw[name] ?? "", 150, (s: string) => {
        edRaw[name] = s;
        touch();
      }),
      help.length > 0 ? help : hint,
    );
  }
  if (def.type === "richtext") return markdownField(name, title, help);
  if (isLongText(def)) {
    return field(
      title,
      def.type === "richtext" ? tag("MARKDOWN") : null,
      textArea(typeof value === "string" ? value : "", def.type === "richtext" ? 280 : 120, (s: string) => {
        edValues[name] = s;
        touch();
      }),
      help,
    );
  }
  if (def.type === "number") {
    return field(
      title,
      null,
      input("0", edRaw[name] ?? "", false, "number", (s: string) => {
        edRaw[name] = s;
        touch();
      }),
      help,
    );
  }
  // text, url, email, date, datetime and anything unrecognised that holds a string
  if (value !== null && value !== undefined && typeof value !== "string" && typeof value !== "number") {
    // An unknown structured type: never flatten it into text.
    edRaw[name] = edRaw[name] ?? prettyJson(value);
    return field(
      title,
      tag("JSON"),
      textArea(edRaw[name] ?? "", 120, (s: string) => {
        edRaw[name] = s;
        touch();
      }),
      help.length > 0 ? help : tr("Structured data, edited as JSON."),
    );
  }
  const placeholder = def.type === "date" ? tr("YYYY-MM-DD") : def.type === "datetime" ? tr("YYYY-MM-DD HH:MM") : def.type === "url" ? "https://" : def.type === "email" ? tr("name@example.com") : "";
  const icon = def.type === "url" ? "link" : def.type === "email" ? "envelope" : def.type === "date" || def.type === "datetime" ? "calendar" : "";
  return field(
    title,
    null,
    input(placeholder, plain(value), false, icon, (s: string) => {
      edValues[name] = s;
      touch();
    }),
    help,
  );
}

/**
 * Turn the edit buffers into the `fields` object to send. PATCH replaces the
 * whole object, so every stored key is carried over, edited or not. Returns
 * an error message instead when a buffer can't be parsed.
 */
function collectFields(): { fields: Record<string, unknown>; error: string } {
  const out: Record<string, unknown> = {};
  for (const key in edValues) out[key] = edValues[key];
  const defs = edType ? edType.fieldsSchema.fields : [];
  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    if (!def) continue;
    const name = def.name;
    const shown = def.label && def.label.length > 0 ? def.label : name;
    const raw = edRaw[name];
    if (def.type === "number") {
      if (raw === undefined) continue;
      const trimmed = raw.trim().replace(",", ".");
      if (trimmed.length === 0) {
        out[name] = null;
        continue;
      }
      const n = Number(trimmed);
      if (!(n === n) || !isFinite(n)) return { fields: out, error: tr("“{field}” needs a number.", { field: shown }) };
      out[name] = n;
    } else if (raw !== undefined && (isJsonField(def) || (typeof out[name] === "object" && out[name] !== null))) {
      const trimmed = raw.trim();
      if (trimmed.length === 0) {
        out[name] = null;
        continue;
      }
      try {
        out[name] = JSON.parse(trimmed);
      } catch {
        return { fields: out, error: tr("“{field}” isn't valid JSON. Check brackets, quotes and commas.", { field: shown }) };
      }
    } else if (typeof out[name] === "string" && !isLongText(def) && (out[name] as string).length === 0 && !def.required) {
      out[name] = null;
    }
  }
  return { fields: out, error: "" };
}

async function doSave(thenPublish: boolean): Promise<void> {
  const it = edItem;
  if (!it || edBusy) return;
  const title = edTitle.trim();
  const slug = edSlug.trim().toLowerCase();
  if (title.length === 0 || slug.length === 0) {
    setNotice(tr("Title and slug can't be empty."), 1);
    return;
  }
  const collected = collectFields();
  if (collected.error.length > 0) {
    setNotice(collected.error, 1);
    return;
  }
  const seo: Record<string, unknown> = {};
  for (const key in it.seo) seo[key] = it.seo[key];
  seo["metaTitle"] = edSeoTitle;
  seo["metaDescription"] = edSeoDesc;

  edBusy = true;
  setNotice(thenPublish ? tr("Publishing…") : tr("Saving…"), 0);
  let saved = false;
  try {
    let updated = it;
    if (edDirty || !thenPublish) {
      updated = await api.updateContent(it.id, { title, slug, fields: collected.fields, seo });
      saved = true;
    }
    if (thenPublish) updated = await api.publishContent(it.id);
    edBusy = false;
    contentStale = true;
    homeLoaded = false;
    loadEditorBuffers(updated);
    redrawEditor();
    setNotice(thenPublish ? tr("Published — it's live") : tr("Saved"), 2);
  } catch (e) {
    edBusy = false;
    if (saved) {
      // The edits are stored; only the publish step was refused.
      edDirty = false;
      contentStale = true;
      if (edStateLabel) {
        textSetString(edStateLabel, tr("Saved as draft"));
        color(edStateLabel, MUTED);
      }
    }
    if (e instanceof ApiError && e.status === 401) {
      fail(e);
      return;
    }
    haptic("error");
    setNotice((saved ? tr("Saved, but not published. ") : "") + errorMessage(e), 1);
  }
}

async function doUnpublish(): Promise<void> {
  const it = edItem;
  if (!it || edBusy) return;
  edBusy = true;
  setNotice(tr("Unpublishing…"), 0);
  try {
    const updated = await api.unpublishContent(it.id);
    edBusy = false;
    contentStale = true;
    homeLoaded = false;
    if (updated) {
      if (edDirty) {
        // Keep unsaved edits; only the status changed.
        it.status = updated.status;
        it.updatedAt = updated.updatedAt;
      } else {
        loadEditorBuffers(updated);
      }
    }
    redrawEditor();
    setNotice(tr("Unpublished — it's a draft again"), 2);
  } catch (e) {
    edBusy = false;
    fail(e);
  }
}

async function doDelete(hard: boolean): Promise<void> {
  const it = edItem;
  if (!it || edBusy) return;
  edBusy = true;
  setNotice(hard ? tr("Deleting…") : tr("Archiving…"), 0);
  try {
    await api.deleteContent(it.id, hard);
    edBusy = false;
    edDirty = false;
    edItem = null;
    contentStale = true;
    homeLoaded = false;
    leave();
    setNotice(hard ? tr("Deleted") : tr("Archived"), 2);
  } catch (e) {
    edBusy = false;
    fail(e);
  }
}

// ---------- media --------------------------------------------------------

function screenMedia(seq: number, reload: boolean): void {
  const picking = pickField.length > 0 && navStack.length > 1;
  const allowUpload = can("manageMedia");
  if (picking) setBarHeader(tr("Choose image"), allowUpload ? [headerAction("plus", tr("Upload"), () => startUpload())] : []);
  else setLargeHeader("", tr("Media"), allowUpload ? [isWide ? chipButton(tr("Upload"), "arrow.up.circle", B_PRIMARY, () => startUpload()) : circleAction("plus", () => startUpload())] : []);
  add(
    content,
    searchField(tr("Search files"), mediaFilter, (s: string) => {
      mediaFilter = s;
      mediaShown = isWide ? 48 : 36;
      drawMediaGrid(picking);
    }),
  );
  const box = column(10);
  mediaGridBox = box;
  add(content, box);
  if (mediaLoaded) drawMediaGrid(picking);
  else add(box, loadingBlock(tr("Loading your library…")));
  if (!mediaLoaded || reload) {
    void (async () => {
      try {
        setMedia(await api.listMedia(200));
      } catch (e) {
        if (isCurrent(seq)) fail(e);
        return;
      }
      if (!isCurrent(seq)) return;
      drawMediaGrid(picking);
    })();
  }
}

function mediaTile(m: MediaItem, h: number, picking: boolean): Widget {
  let tile: Widget;
  if (isPicture(m) && m.sizeBytes <= THUMB_MAX_BYTES) {
    tile = Image(api.mediaRawUrl(m.id), "");
    widgetSetHeight(tile, h);
    bg(tile, SURFACE2);
    setCornerRadius(tile, 10);
  } else {
    const dot = m.filename.lastIndexOf(".");
    const ext = dot >= 0 ? m.filename.slice(dot + 1).toUpperCase().slice(0, 4) : "FILE";
    tile = centerColumn(6);
    widgetSetHeight(tile, h);
    bg(tile, SURFACE2);
    setCornerRadius(tile, 10);
    setPadding(tile, h / 2 - 22, 4, 0, 4);
    put(tile, symbol(isPicture(m) ? "photo" : m.mimeType.indexOf("video/") === 0 ? "film" : "doc", 24, MUTED));
    put(tile, tag(ext));
  }
  onTap(tile, () => {
    if (picking) choosePickedMedia(m);
    else {
      selMedia = m;
      loadMediaAltBuffers(m);
      go(R_MEDIA_DETAIL);
    }
  });
  return tile;
}

function drawMediaGrid(picking: boolean): void {
  const box = mediaGridBox;
  if (!box) return;
  widgetClearChildren(box);
  const needle = mediaFilter.trim().toLowerCase();
  const list: MediaItem[] = [];
  for (let i = 0; i < cMedia.length; i++) {
    const m = cMedia[i];
    if (!m) continue;
    if (picking && !isPicture(m)) continue;
    if (needle.length > 0) {
      let hay = decodeName(m.filename).toLowerCase();
      for (const k in m.altText) hay += ` ${(m.altText[k] ?? "").toLowerCase()}`;
      if (hay.indexOf(needle) < 0) continue;
    }
    list.push(m);
  }
  if (list.length === 0) {
    if (needle.length > 0) add(box, emptyState("magnifyingglass", tr("No matches"), tr("No file name or description matches “{q}”.", { q: mediaFilter.trim() }), "", null));
    else
      add(
        box,
        emptyState("photo.on.rectangle.angled", tr("Your library is empty"), tr("Upload photos from your phone and use them on any page."), can("manageMedia") ? tr("Upload a photo") : "", can("manageMedia") ? () => startUpload() : null),
      );
    return;
  }
  const cols = isDesktop ? 6 : isPad ? 4 : 3;
  const h = isDesktop ? 150 : isPad ? 170 : 116;
  const shown = Math.min(list.length, mediaShown);
  const grid = column(6);
  for (let i = 0; i < shown; i += cols) {
    const r = HStack(6, []);
    stackSetDistribution(r, 1);
    for (let k = 0; k < cols; k++) {
      const m = list[i + k];
      if (m && i + k < shown) put(r, mediaTile(m, h, picking));
      else {
        const blank = VStack(0, []);
        widgetSetHeight(blank, h);
        put(r, blank);
      }
    }
    add(grid, r);
  }
  add(box, grid);
  if (shown < list.length) {
    add(
      box,
      button(tr("Show more ({n})", { n: list.length - shown }), "", B_TINTED, 44, () => {
        mediaShown += isWide ? 48 : 36;
        drawMediaGrid(picking);
      }),
    );
  }
  const note = cMedia.length >= 200 ? tr("Showing the newest 200 files") : plural(list.length, "{n} file", "{n} files");
  add(box, footnote(picking ? `${tr("Tap an image to use it")} · ${note}` : note));
}

/** Write the chosen media id into the editor field that asked for it. */
function choosePickedMedia(m: MediaItem): void {
  const name = pickField;
  pickField = "";
  if (pickMarkdown) {
    pickMarkdown = false;
    const ed = mdEditors[name];
    haptic("light");
    leave();
    if (ed) {
      const locale = edItem ? edItem.locale : defaultLocale;
      const alt = (m.altText[locale] ?? m.altText[defaultLocale] ?? "").replace(/[\[\]]/g, "");
      // Relative URL: the CMS serves media on the site's own domain.
      const url = m.urlRaw.length > 0 ? m.urlRaw : `/api/v1/media/${m.id}/raw`;
      setTimeout(() => {
        insertMarkdown(ed, `![${alt}](${url})`);
        focusEditor(ed);
      }, 60);
    }
    return;
  }
  if (pickAppend) {
    const ids = galleryIds(edRaw[name] ?? "") ?? [];
    ids.push(m.id);
    edRaw[name] = prettyJson(ids);
  } else {
    edValues[name] = m.id;
  }
  edDirty = true;
  haptic("light");
  leave();
}

let altBuffers: Record<string, string> = {};

function loadMediaAltBuffers(m: MediaItem): void {
  altBuffers = {};
  for (let i = 0; i < siteLocales.length; i++) {
    const l = siteLocales[i] ?? "";
    altBuffers[l] = m.altText[l] ?? "";
  }
}

function screenMediaDetail(): void {
  const m = selMedia;
  if (!m) {
    leave();
    return;
  }
  const url = api.mediaRawUrl(m.id);
  setBarHeader(tr("File"), [headerAction("square.and.arrow.up", tr("Share"), () => shareUrl(url, decodeName(m.filename)))]);
  if (isPicture(m)) {
    const img = Image(url, "");
    widgetSetHeight(img, isDesktop ? 420 : isPad ? 460 : 300);
    bg(img, SURFACE2);
    setCornerRadius(img, 16);
    add(content, img);
  } else {
    const ph = centerColumn(10);
    bg(ph, SURFACE);
    setCornerRadius(ph, 16);
    setPadding(ph, 40, 16, 40, 16);
    put(ph, softTile("doc.fill", BRAND_INK, BRAND_TINT, 64, true));
    add(content, ph);
  }
  const head = column(2);
  setPadding(head, 2, 4, 0, 4);
  add(head, text(decodeName(m.filename), 18, 700, INK, 2));
  add(head, caption(tr("Uploaded {when}", { when: relTimeInline(m.createdAt) })));
  add(content, head);

  const rows: Widget[] = [];
  rows.push(infoItem(tr("Type"), m.mimeType));
  rows.push(infoItem(tr("Size"), fileSize(m.sizeBytes)));
  const dims = plausibleDims(m);
  if (dims.length > 0) rows.push(infoItem(tr("Dimensions"), dims));
  rows.push(infoItem(tr("Uploaded"), fullTime(m.createdAt)));
  add(content, group(rows, 16));

  add(
    content,
    buttonRow([
      button(tr("Copy link"), "link", B_TINTED, 44, () => {
        clipboardWrite(url);
        setNotice(tr("Link copied"), 2);
      }),
      button(tr("Open"), "arrow.up.right.square", B_TINTED, 44, () => openURL(url)),
    ]),
  );

  if (can("manageMedia")) {
    add(content, groupLabel(tr("Alt text")));
    const alt = card(16, 14);
    for (let i = 0; i < siteLocales.length; i++) {
      const l = siteLocales[i] ?? "";
      add(
        alt,
        field(
          siteLocales.length > 1 ? l.toUpperCase() : tr("Description"),
          null,
          input(tr("Describe the image"), altBuffers[l] ?? "", false, "", (s: string) => {
            altBuffers[l] = s;
          }),
          "",
        ),
      );
    }
    add(alt, caption(tr("Read aloud by screen readers and used by search engines.")));
    add(
      alt,
      button(tr("Save alt text"), "", B_SECONDARY, 44, () => {
        void doSaveAlt();
      }),
    );
    add(content, alt);
    add(
      content,
      group(
        [
          actionItem(symbol("trash", 18, DANGER), tr("Delete file"), DANGER, () => {
            confirm(tr("Delete this file?"), tr("Pages that use it will show a broken image. This can't be undone."), tr("Delete"), () => {
              void doDeleteMedia();
            });
          }),
        ],
        16,
      ),
    );
  }
}

async function doSaveAlt(): Promise<void> {
  const m = selMedia;
  if (!m) return;
  const alt: Record<string, string> = {};
  for (const key in m.altText) alt[key] = m.altText[key] ?? "";
  for (const key in altBuffers) alt[key] = (altBuffers[key] ?? "").trim();
  setNotice(tr("Saving…"), 0);
  try {
    await api.updateMediaAlt(m.id, alt);
    m.altText = alt;
    setNotice(tr("Alt text saved"), 2);
  } catch (e) {
    fail(e);
  }
}

async function doDeleteMedia(): Promise<void> {
  const m = selMedia;
  if (!m) return;
  setNotice(tr("Deleting…"), 0);
  try {
    await api.deleteMedia(m.id);
    const next: MediaItem[] = [];
    for (let i = 0; i < cMedia.length; i++) {
      const other = cMedia[i];
      if (other && other.id !== m.id) next.push(other);
    }
    setMedia(next);
    selMedia = null;
    leave();
    setNotice(tr("File deleted"), 2);
  } catch (e) {
    fail(e);
  }
}

let upPath = "";
let upName = "";
let upAlt = "";
let upBusy = false;

function startUpload(): void {
  imagePickerPick(1, false, (paths: string[]) => {
    const path = paths && paths.length > 0 ? (paths[0] ?? "") : "";
    if (path.length === 0) return;
    upPath = path.replace(/^file:\/\//, "");
    upName = baseName(upPath);
    upAlt = "";
    upBusy = false;
    go(R_UPLOAD);
  });
}

function screenUpload(): void {
  setBarHeader(tr("Upload"), []);
  const preview = ImageFile(upPath);
  widgetSetHeight(preview, isDesktop ? 380 : isPad ? 420 : 280);
  bg(preview, SURFACE2);
  setCornerRadius(preview, 16);
  add(content, preview);
  const form = card(16, 14);
  add(form, text(decodeName(upName), 15, 600, INK, 1));
  add(
    form,
    field(
      `${tr("Alt text")}${siteLocales.length > 1 ? ` (${defaultLocale.toUpperCase()})` : ""}`,
      null,
      input(tr("What does the picture show?"), upAlt, false, "", (s: string) => {
        upAlt = s;
      }),
      tr("Required. One short sentence, read aloud by screen readers and used by search engines."),
    ),
  );
  add(content, form);
  setActions([
    button(upBusy ? tr("Uploading…") : tr("Upload to library"), "arrow.up.circle.fill", B_PRIMARY, AB_H, () => {
      void doUpload();
    }),
  ]);
}

async function doUpload(): Promise<void> {
  if (upBusy) return;
  const alt = upAlt.trim();
  if (alt.length === 0) {
    setNotice(tr("Add a short description of the image first."), 1);
    return;
  }
  upBusy = true;
  setNotice(tr("Uploading…"), 0);
  const altText: Record<string, string> = {};
  altText[defaultLocale] = alt;
  try {
    const it = await api.uploadMedia(upPath, upName, altText);
    upBusy = false;
    const next: MediaItem[] = [it];
    for (let i = 0; i < cMedia.length; i++) {
      const other = cMedia[i];
      if (other) next.push(other);
    }
    setMedia(next);
    if (pickField.length > 0) {
      // Uploaded while choosing an image: use it straight away.
      navStack.pop();
      navTitles.pop();
      navOffsets.pop();
      choosePickedMedia(it);
    } else {
      leave();
    }
    setNotice(tr("Uploaded"), 2);
  } catch (e) {
    upBusy = false;
    fail(e);
  }
}

// ---------- inbox (forms) ------------------------------------------------

const NAME_KEYS = ["name", "fullname", "full_name", "yourname", "vorname", "firstname", "first_name", "contactname"];
const LAST_KEYS = ["lastname", "last_name", "nachname", "surname"];
const MESSAGE_KEYS = ["message", "nachricht", "comment", "comments", "text", "body", "anfrage", "notes", "inquiry"];

function dataValue(s: FormSubmission, keys: string[]): string {
  for (const key in s.data) {
    if (keys.indexOf(key.toLowerCase().replace(/[\s-]/g, "")) >= 0) {
      const v = plain(s.data[key]).trim();
      if (v.length > 0) return v;
    }
  }
  return "";
}
function findEmail(s: FormSubmission): string {
  for (const key in s.data) {
    const v = plain(s.data[key]).trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return v;
  }
  return "";
}
function senderName(s: FormSubmission): string {
  const first = dataValue(s, NAME_KEYS);
  const last = dataValue(s, LAST_KEYS);
  const full = `${first} ${last}`.trim();
  if (full.length > 0) return full;
  const email = findEmail(s);
  return email.length > 0 ? email : tr("Submission #{id}", { id: s.id });
}
function messagePreview(s: FormSubmission): string {
  const msg = dataValue(s, MESSAGE_KEYS);
  if (msg.length > 0) return msg.replace(/\s+/g, " ");
  const name = senderName(s);
  const email = findEmail(s);
  const parts: string[] = [];
  for (const key in s.data) {
    const v = plain(s.data[key]).trim();
    if (v.length === 0 || v === email || name.indexOf(v) >= 0) continue;
    parts.push(v);
    if (parts.length >= 3) break;
  }
  return parts.join(" · ").replace(/\s+/g, " ");
}

function inboxRow(e: InboxEntry): Widget {
  const s = e.s;
  const who = senderName(s);
  const r = HStack(12, []);
  stackSetAlignment_top(r);
  setPadding(r, 13, 16, 13, 14);
  put(r, avatar(who, findEmail(s) + who, 40));
  const col = column(3);
  const top = hrow(8);
  put(top, grow(text(who, 16, 600, INK, 1)));
  put(top, text(inboxTime(s.createdAt), 13, 400, MUTED, 1));
  add(col, top);
  const preview = messagePreview(s);
  if (preview.length > 0) add(col, text(preview, 14, 400, BODY, 2));
  const meta = hrow(6);
  put(meta, tag(e.formTitle));
  if (s.isSpam) put(meta, pill(tr("Spam"), K_DANGER));
  put(meta, Spacer());
  add(col, meta);
  put(r, grow(col));
  onTap(r, () => {
    selEntry = e;
    go(R_SUBMISSION);
  });
  return r;
}
function stackSetAlignment_top(w: Widget): void {
  // HStack top alignment (NSLayoutAttribute top = 3; iOS maps it to .top).
  stackSetAlignment(w, 3);
}

function screenInbox(seq: number, reload: boolean): void {
  setLargeHeader("", tr("Inbox"), []);
  const seg = segmented([tr("Messages"), tr("Spam")], inboxSpam ? 1 : 0, (i: number) => {
    inboxSpam = i === 1;
    reloadInbox();
  });
  if (isWide) {
    const r = hrow(0);
    widgetSetWidth(seg, 260);
    put(r, seg);
    put(r, Spacer());
    add(content, r);
  } else {
    add(content, seg);
  }
  if (cForms.length > 1) {
    const labels: string[] = [tr("All forms")];
    for (let i = 0; i < cForms.length; i++) labels.push((cForms[i] ?? { title: "" }).title);
    add(
      content,
      chips(labels, [inboxForm + 1], false, (sel: number[]) => {
        inboxForm = (sel[0] ?? 0) - 1;
        drawInbox();
      }),
    );
  }
  const box = column(10);
  inboxListBox = box;
  add(content, box);
  if (inboxLoaded && !reload) {
    drawInbox();
    return;
  }
  if (inboxLoaded) drawInbox();
  else add(box, skeletonList(6, true, alive(seq)));
  void loadInbox(seq);
}

function reloadInbox(): void {
  const box = inboxListBox;
  if (!box) return;
  renderSeq++;
  const seq = renderSeq;
  widgetClearChildren(box);
  add(box, skeletonList(6, true, alive(seq)));
  void loadInbox(seq);
}

async function loadInbox(seq: number): Promise<void> {
  const hadForms = cForms.length;
  try {
    cInbox = await loadInboxEntries(inboxSpam);
    inboxLoaded = true;
  } catch (e) {
    if (isCurrent(seq)) fail(e);
    return;
  }
  if (!isCurrent(seq)) return;
  // The form filter chips depend on the form list; redraw if it changed.
  if (hadForms !== cForms.length && cForms.length > 1) render(false);
  else drawInbox();
}

function drawInbox(): void {
  const box = inboxListBox;
  if (!box || currentRoute() !== R_FORMS) return;
  widgetClearChildren(box);
  if (cForms.length === 0) {
    add(box, emptyState("tray", tr("No forms on this site"), tr("Contact and enquiry forms you add in the CMS collect their messages here."), "", null));
    return;
  }
  const slug = inboxForm >= 0 ? (cForms[inboxForm] ?? { slug: "" }).slug : "";
  let bucket = -1;
  let rows: Widget[] = [];
  let shown = 0;
  for (let i = 0; i < cInbox.length; i++) {
    const e = cInbox[i];
    if (!e) continue;
    if (inboxSpam !== !!e.s.isSpam) continue;
    if (slug.length > 0 && e.formSlug !== slug) continue;
    const b = dayBucket(e.s.createdAt);
    if (b !== bucket) {
      if (rows.length > 0) add(box, group(rows, 68));
      rows = [];
      bucket = b;
      add(box, groupLabel(BUCKET_LABELS[b] ?? ""));
    }
    rows.push(inboxRow(e));
    shown++;
  }
  if (rows.length > 0) add(box, group(rows, 68));
  if (shown === 0) {
    add(
      box,
      inboxSpam
        ? emptyState("checkmark.shield", tr("No spam"), tr("Messages flagged as spam land here."), "", null)
        : emptyState("tray", tr("Inbox zero"), tr("When someone fills in a form on your website, it shows up here."), "", null),
    );
  }
}

function screenSubmission(): void {
  const e = selEntry;
  if (!e) {
    leave();
    return;
  }
  const s = e.s;
  const who = senderName(s);
  const email = findEmail(s);
  setBarHeader(tr("Message"), []);

  const head = card(20, 8);
  const hc = centerColumn(6);
  put(hc, avatar(who, email + who, 64));
  put(hc, gap(4));
  put(hc, text(who, 20, 700, INK, 1));
  if (email.length > 0 && email !== who) put(hc, text(email, 15, 400, MUTED, 1));
  const meta = hrow(6);
  put(meta, tag(e.formTitle));
  if (s.isSpam) put(meta, pill(tr("Spam"), K_DANGER));
  put(hc, meta);
  put(hc, text(fullTime(s.createdAt), 13, 400, MUTED, 1));
  add(head, hc);
  const acts: Widget[] = [];
  if (email.length > 0) acts.push(button(tr("Reply"), "arrowshape.turn.up.left.fill", B_PRIMARY, 44, () => openURL(`mailto:${email}`)));
  const lines: string[] = [];
  for (const key in s.data) lines.push(`${key}: ${plain(s.data[key])}`);
  acts.push(
    button(tr("Copy"), "doc.on.doc", B_TINTED, 44, () => {
      clipboardWrite(lines.join("\n"));
      setNotice(tr("Copied"), 2);
    }),
  );
  put(head, gap(6));
  add(head, buttonRow(acts));
  add(content, head);

  const rows: Widget[] = [];
  for (const key in s.data) {
    const c = column(3);
    setPadding(c, 12, 16, 12, 16);
    put(c, text(key, 13, 500, MUTED, 1));
    add(c, text(plain(s.data[key]).length > 0 ? plain(s.data[key]) : "—", 16, 400, INK, 0));
    rows.push(c);
  }
  if (rows.length > 0) {
    add(content, groupLabel(tr("Details")));
    add(content, group(rows, 16));
  }

  if (can("manageForms")) {
    const danger: Widget[] = [];
    if (!s.isSpam) {
      danger.push(
        actionItem(symbol("xmark.bin", 18, WARN_FG), tr("Mark as spam"), WARN_FG, () => {
          void doSubmissionAction(e, false);
        }),
      );
    }
    danger.push(
      actionItem(symbol("trash", 18, DANGER), tr("Delete message"), DANGER, () => {
        confirm(tr("Delete this message?"), tr("This can't be undone."), tr("Delete"), () => {
          void doSubmissionAction(e, true);
        });
      }),
    );
    add(content, gap(2));
    add(content, group(danger, 48));
  }
}

async function doSubmissionAction(e: InboxEntry, remove: boolean): Promise<void> {
  setNotice(remove ? tr("Deleting…") : tr("Marking as spam…"), 0);
  try {
    if (remove) await api.deleteSubmission(e.s.id);
    else await api.markSubmissionSpam(e.s.id);
    const next: InboxEntry[] = [];
    for (let i = 0; i < cInbox.length; i++) {
      const other = cInbox[i];
      if (!other) continue;
      if (other.s.id === e.s.id) {
        if (remove || !inboxSpam) continue;
        other.s.isSpam = 1;
      }
      next.push(other);
    }
    cInbox = next;
    selEntry = null;
    leave();
    setNotice(remove ? tr("Message deleted") : tr("Moved to spam"), 2);
  } catch (err) {
    fail(err);
  }
}

// ---------- more ---------------------------------------------------------

function screenMore(): void {
  setLargeHeader("", tr("More"), []);
  const who = me;
  if (who) {
    const c = card(16, 0);
    const r = hrow(14);
    put(r, avatar(who.user.displayName, who.user.email, 54));
    const tx = column(3);
    put(tx, text(who.user.displayName, 18, 700, INK, 1));
    put(tx, text(who.user.email, 14, 400, MUTED, 1));
    put(tx, pill(who.user.role.label, K_BRAND));
    put(r, grow(tx));
    put(r, symbol("chevron.right", 13, FAINT));
    add(c, r);
    onTap(c, () => go(R_ACCOUNT));
    add(content, c);
  }

  const site: Widget[] = [];
  if (can("manageMenus")) site.push(item(iconTile("list.bullet", TILE_BLUE, 30), tr("Menus"), "", null, true, () => go(R_MENUS)));
  if (can("manageRedirects")) site.push(item(iconTile("arrow.triangle.branch", TILE_INDIGO, 30), tr("Redirects"), "", null, true, () => go(R_REDIRECTS)));
  if (can("manageSettings")) site.push(item(iconTile("gearshape.fill", TILE_GRAY, 30), tr("Settings"), "", null, true, () => go(R_SETTINGS)));
  if (can("manageUsers")) site.push(item(iconTile("person.2.fill", TILE_GREEN, 30), tr("Team"), "", null, true, () => go(R_USERS)));
  if (site.length > 0) {
    add(content, groupLabel(tr("Website")));
    add(content, group(site, 58));
  }

  const dev: Widget[] = [];
  if (can("manageSettings")) dev.push(item(iconTile("bolt.fill", TILE_YELLOW, 30), tr("Webhooks"), "", null, true, () => go(R_WEBHOOKS)));
  if (can("manageJobs")) dev.push(item(iconTile("clock.arrow.circlepath", TILE_PURPLE, 30), tr("Background jobs"), "", hJobsBad > 0 ? pill(String(hJobsBad), K_DANGER) : null, true, () => go(R_JOBS)));
  if (dev.length > 0) {
    add(content, groupLabel(tr("Developer")));
    add(content, group(dev, 58));
  }

  add(content, groupLabel(tr("Sites")));
  const sites = store.loadSites();
  const siteRows: Widget[] = [];
  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    if (!s) continue;
    const current = s.baseUrl === api.getBaseUrl();
    siteRows.push(
      item(avatar(siteName(s.baseUrl), s.baseUrl, 30), siteName(s.baseUrl), s.email, current ? symbol("checkmark", 16, BRAND_INK) : null, false, current ? null : () => switchSite(s)),
    );
  }
  siteRows.push(item(iconTile("plus", TILE_ORANGE, 30), tr("Add a site"), "", null, false, () => addAnotherSite()));
  siteRows.push(item(iconTile("safari.fill", TILE_TEAL, 30), tr("Visit website"), hostOf(api.getBaseUrl()), null, false, () => openURL(api.getBaseUrl())));
  add(content, group(siteRows, 58));

  add(content, gap(2));
  add(
    content,
    group(
      [
        actionItem(null, tr("Sign out"), DANGER, () => {
          confirm(tr("Sign out?"), tr("You'll need your password to sign in to {site} again.", { site: siteName(api.getBaseUrl()) }), tr("Sign out"), () => {
            void doSignOut();
          });
        }),
      ],
      16,
    ),
  );
  const v = getAppVersion();
  const ver = text(`Skelpo CMS${v.length > 0 ? ` ${v}` : ""}`, 12, 500, FAINT, 1);
  textSetTextAlignment(ver, 2);
  add(content, ver);
}

function switchSite(site: store.SavedSite): void {
  me = null;
  navStack = [R_SIGNIN];
  navTitles = [""];
  navOffsets = [0];
  void resumeSite(site);
}

// ---------- menus --------------------------------------------------------

function screenMenus(seq: number, reload: boolean): void {
  setBarHeader(tr("Menus"), []);
  if (menusLoaded && !reload) {
    drawMenus();
    return;
  }
  showSkeleton(seq, 3, true);
  void (async () => {
    try {
      cMenus = await api.listMenus();
      menusLoaded = true;
    } catch (e) {
      if (isCurrent(seq)) fail(e);
      return;
    }
    if (!isCurrent(seq)) return;
    widgetClearChildren(content);
    drawMenus();
  })();
}

function drawMenus(): void {
  if (cMenus.length === 0) {
    add(content, emptyState("list.bullet", tr("No menus"), tr("Navigation menus are set up by a developer in the CMS."), "", null));
    return;
  }
  const rows: Widget[] = [];
  for (let i = 0; i < cMenus.length; i++) {
    const m = cMenus[i];
    if (!m) continue;
    rows.push(
      item(iconTile("list.bullet", TILE_BLUE, 30), m.label, m.slug, null, true, () => {
        selMenu = m;
        menuLocale = defaultLocale;
        go(R_MENU);
      }),
    );
  }
  add(content, group(rows, 58));
}

let menuLocale = "";
let newLinkLabel = "";
let newLinkUrl = "";

function flattenMenu(items: MenuItem[], depth: number, out: { item: MenuItem; depth: number }[]): void {
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it) continue;
    out.push({ item: it, depth });
    if (it.children && it.children.length > 0) flattenMenu(it.children, depth + 1, out);
  }
}

function screenMenu(seq: number, reload: boolean): void {
  const m = selMenu;
  if (!m) {
    leave();
    return;
  }
  setBarHeader(m.label, [
    headerAction("plus", tr("Add link"), () => {
      newLinkLabel = "";
      newLinkUrl = "";
      go(R_MENU_ADD);
    }),
  ]);
  if (siteLocales.length > 1) {
    add(
      content,
      segmented(localeLabels(), siteLocales.indexOf(menuLocale), (i: number) => {
        menuLocale = siteLocales[i] ?? defaultLocale;
        render(true);
      }),
    );
  }
  const key = `${m.slug}:${menuLocale}`;
  if (menuItemsFor === key && !reload) {
    drawMenu(m);
    return;
  }
  showSkeleton(seq, 5, false);
  void (async () => {
    try {
      const detail = await api.getMenu(m.slug, menuLocale);
      const flat: { item: MenuItem; depth: number }[] = [];
      flattenMenu(detail.items, 0, flat);
      cMenuItems = flat;
      menuItemsFor = key;
    } catch (e) {
      if (isCurrent(seq)) fail(e);
      return;
    }
    if (!isCurrent(seq)) return;
    render(false);
  })();
}

function drawMenu(m: MenuSummary): void {
  if (cMenuItems.length === 0) {
    add(
      content,
      emptyState("link", tr("No links yet"), tr("Add the pages people should find in this menu."), tr("Add a link"), () => {
        newLinkLabel = "";
        newLinkUrl = "";
        go(R_MENU_ADD);
      }),
    );
    return;
  }
  const rows: Widget[] = [];
  for (let i = 0; i < cMenuItems.length; i++) {
    const entry = cMenuItems[i];
    if (!entry) continue;
    const it = entry.item;
    const target = it.url ? it.url : it.contentId ? tr("Linked page #{id}", { id: it.contentId }) : "";
    const r = item(symbol(entry.depth > 0 ? "arrow.turn.down.right" : it.contentId ? "doc.text" : "link", 16, entry.depth > 0 ? FAINT : BRAND_INK), it.label, target, null, false, () => {
      confirm(tr("Remove this link?"), tr("“{label}” is taken out of the menu.", { label: it.label }), tr("Remove"), () => {
        void (async () => {
          setNotice(tr("Removing…"), 0);
          try {
            await api.deleteMenuItem(m.slug, it.id);
            render(true);
            setNotice(tr("Link removed"), 2);
          } catch (e) {
            fail(e);
          }
        })();
      });
    });
    if (entry.depth > 0) setPadding(r, 12, 16 + entry.depth * 22, 12, 14);
    rows.push(r);
  }
  add(content, group(rows, 46));
  add(content, footnote(tr("Tap a link to remove it. Reordering and nesting are done in the CMS.")));
}

function screenMenuAdd(): void {
  const m = selMenu;
  if (!m) {
    leave();
    return;
  }
  setBarHeader(tr("Add link"), []);
  const form = card(16, 16);
  add(
    form,
    field(
      `${tr("Label")}${siteLocales.length > 1 ? ` (${menuLocale.toUpperCase()})` : ""}`,
      null,
      input(tr("About us"), newLinkLabel, false, "textformat", (s: string) => {
        newLinkLabel = s;
      }),
      "",
    ),
  );
  add(
    form,
    field(
      tr("Address"),
      null,
      input(tr("/about or https://…"), newLinkUrl, false, "link", (s: string) => {
        newLinkUrl = s;
      }),
      tr("A path on your site, or a full web address."),
    ),
  );
  add(content, form);
  setActions([
    button(tr("Add to menu"), "plus", B_PRIMARY, AB_H, () => {
      void (async () => {
        const label = newLinkLabel.trim();
        const url = newLinkUrl.trim();
        if (label.length === 0 || url.length === 0) {
          setNotice(tr("Enter a label and an address."), 1);
          return;
        }
        const labelMap: Record<string, string> = {};
        labelMap[menuLocale] = label;
        setNotice(tr("Adding…"), 0);
        try {
          await api.createMenuItem(m.slug, { label: labelMap, url, sortOrder: cMenuItems.length + 1 });
          newLinkLabel = "";
          newLinkUrl = "";
          menuItemsFor = "";
          leave();
          setNotice(tr("Link added"), 2);
        } catch (e) {
          fail(e);
        }
      })();
    }),
  ]);
}

// ---------- redirects ----------------------------------------------------

let newRedirectSource = "";
let newRedirectDest = "";
const REDIRECT_CODES = [301, 302, 307, 308];
let newRedirectCode = 0;

function screenRedirects(seq: number, reload: boolean): void {
  setBarHeader(tr("Redirects"), [
    headerAction("plus", tr("New redirect"), () => {
      newRedirectSource = "";
      newRedirectDest = "";
      newRedirectCode = 0;
      go(R_REDIRECT_ADD);
    }),
  ]);
  if (redirectsLoaded && !reload) {
    drawRedirects();
    return;
  }
  showSkeleton(seq, 5, false);
  void (async () => {
    try {
      cRedirects = await api.listRedirects();
      redirectsLoaded = true;
    } catch (e) {
      if (isCurrent(seq)) fail(e);
      return;
    }
    if (!isCurrent(seq)) return;
    widgetClearChildren(content);
    drawRedirects();
  })();
}

function drawRedirects(): void {
  if (cRedirects.length === 0) {
    add(
      content,
      emptyState("arrow.triangle.branch", tr("No redirects"), tr("Forward old or short addresses to the right page, so links keep working."), tr("Add a redirect"), () => go(R_REDIRECT_ADD)),
    );
    return;
  }
  const rows: Widget[] = [];
  for (let i = 0; i < cRedirects.length; i++) {
    const r = cRedirects[i];
    if (!r) continue;
    rows.push(
      item(null, r.source, `→ ${r.destination}`, pill(String(r.statusCode), r.statusCode === 301 || r.statusCode === 308 ? K_INFO : K_NEUTRAL), false, () => {
        confirm(tr("Remove this redirect?"), tr("{from} will stop forwarding to {to}.", { from: r.source, to: r.destination }), tr("Remove"), () => {
          void (async () => {
            setNotice(tr("Removing…"), 0);
            try {
              await api.deleteRedirect(r.id);
              render(true);
              setNotice(tr("Redirect removed"), 2);
            } catch (e) {
              fail(e);
            }
          })();
        });
      }),
    );
  }
  add(content, group(rows, 16));
  add(content, footnote(plural(cRedirects.length, "{n} redirect · tap it to remove it", "{n} redirects · tap one to remove it")));
}

function screenRedirectAdd(): void {
  setBarHeader(tr("New redirect"), []);
  const form = card(16, 16);
  add(
    form,
    field(
      tr("From"),
      null,
      input(tr("/old-page"), newRedirectSource, false, "arrow.uturn.right", (s: string) => {
        newRedirectSource = s;
      }),
      "",
    ),
  );
  add(
    form,
    field(
      tr("To"),
      null,
      input(tr("/new-page or https://…"), newRedirectDest, false, "arrow.right", (s: string) => {
        newRedirectDest = s;
      }),
      "",
    ),
  );
  add(
    form,
    field(
      tr("Type"),
      null,
      segmented(["301", "302", "307", "308"], newRedirectCode, (i: number) => {
        newRedirectCode = i;
      }),
      tr("301 for a permanent move (best for search engines), 302 for a temporary one."),
    ),
  );
  add(content, form);
  setActions([
    button(tr("Add redirect"), "plus", B_PRIMARY, AB_H, () => {
      void (async () => {
        const source = newRedirectSource.trim();
        const dest = newRedirectDest.trim();
        if (source.length === 0 || dest.length === 0) {
          setNotice(tr("Enter both addresses."), 1);
          return;
        }
        setNotice(tr("Adding…"), 0);
        try {
          await api.createRedirect(source, dest, REDIRECT_CODES[newRedirectCode] ?? 301);
          redirectsLoaded = false;
          leave();
          setNotice(tr("Redirect added"), 2);
        } catch (e) {
          fail(e);
        }
      })();
    }),
  ]);
}

// ---------- settings -----------------------------------------------------

function screenSettings(seq: number, reload: boolean): void {
  setBarHeader(tr("Settings"), []);
  add(
    content,
    searchField(tr("Search settings"), settingsFilter, (s: string) => {
      settingsFilter = s;
      drawSettings();
    }),
  );
  const box = column(10);
  settingsListBox = box;
  add(content, box);
  if (settingsLoaded && !reload) {
    drawSettings();
    return;
  }
  add(box, skeletonList(7, false, alive(seq)));
  void (async () => {
    try {
      const obj = await api.getSettings();
      const keys = Object.keys(obj).sort();
      const rows: { key: string; value: unknown }[] = [];
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i] ?? "";
        rows.push({ key, value: obj[key] });
      }
      cSettings = rows;
      settingsLoaded = true;
    } catch (e) {
      if (isCurrent(seq)) fail(e);
      return;
    }
    if (!isCurrent(seq)) return;
    drawSettings();
  })();
}

function drawSettings(): void {
  const box = settingsListBox;
  if (!box || currentRoute() !== R_SETTINGS) return;
  widgetClearChildren(box);
  if (cSettings.length === 0) {
    add(box, emptyState("gearshape", tr("No settings"), tr("No settings are stored for this site."), "", null));
    return;
  }
  const needle = settingsFilter.trim().toLowerCase();
  // Group by the key prefix ("site.title" → "site").
  let prefix = "";
  let rows: Widget[] = [];
  for (let i = 0; i < cSettings.length; i++) {
    const s = cSettings[i];
    if (!s) continue;
    const preview = plain(s.value);
    if (needle.length > 0 && s.key.toLowerCase().indexOf(needle) < 0 && preview.toLowerCase().indexOf(needle) < 0) continue;
    const dot = s.key.indexOf(".");
    const p = dot > 0 ? s.key.slice(0, dot) : tr("general");
    if (p !== prefix) {
      if (rows.length > 0) add(box, group(rows, 16));
      rows = [];
      prefix = p;
      add(box, groupLabel(p));
    }
    const short = dot > 0 ? s.key.slice(dot + 1) : s.key;
    rows.push(
      item(null, short, preview.length > 80 ? `${preview.slice(0, 80)}…` : preview, null, true, () => {
        selSettingKey = s.key;
        selSettingIsString = typeof s.value === "string";
        selSettingText = selSettingIsString ? (s.value as string) : prettyJson(s.value);
        go(R_SETTING);
      }),
    );
  }
  if (rows.length > 0) add(box, group(rows, 16));
  else add(box, emptyState("magnifyingglass", tr("No matches"), `No setting matches “${settingsFilter.trim()}”.`, "", null));
}

function screenSetting(): void {
  setBarHeader(tr("Setting"), []);
  const head = column(2);
  setPadding(head, 2, 4, 0, 4);
  add(head, text(selSettingKey, 18, 700, INK, 0));
  add(head, caption(selSettingIsString ? tr("Text value") : tr("Structured value (JSON)")));
  add(content, head);
  const form = card(16, 12);
  add(
    form,
    textArea(selSettingText, 300, (s: string) => {
      selSettingText = s;
    }),
  );
  if (!selSettingIsString) add(form, caption(tr("Keep the brackets, quotes and commas intact.")));
  add(content, form);
  setActions([
    button(tr("Save setting"), "", B_PRIMARY, AB_H, () => {
      void (async () => {
        let value: unknown = selSettingText;
        if (!selSettingIsString) {
          try {
            value = JSON.parse(selSettingText);
          } catch {
            setNotice(tr("That isn't valid JSON. Check brackets, quotes and commas."), 1);
            return;
          }
        }
        setNotice(tr("Saving…"), 0);
        try {
          await api.putSetting(selSettingKey, value);
          for (let i = 0; i < cSettings.length; i++) {
            const row = cSettings[i];
            if (row && row.key === selSettingKey) row.value = value;
          }
          setNotice(tr("Saved"), 2);
        } catch (e) {
          fail(e);
        }
      })();
    }),
  ]);
}

// ---------- webhooks -----------------------------------------------------

function screenWebhooks(seq: number, reload: boolean): void {
  setBarHeader(tr("Webhooks"), []);
  if (webhooksLoaded && !reload) {
    drawWebhooks();
    return;
  }
  showSkeleton(seq, 3, true);
  void (async () => {
    try {
      cWebhooks = await api.listWebhooks();
      webhooksLoaded = true;
    } catch (e) {
      if (isCurrent(seq)) fail(e);
      return;
    }
    if (!isCurrent(seq)) return;
    widgetClearChildren(content);
    drawWebhooks();
  })();
}

function drawWebhooks(): void {
  if (cWebhooks.length === 0) {
    add(content, emptyState("bolt", tr("No webhooks"), tr("Webhooks notify other systems when content changes. A developer sets them up in the CMS."), "", null));
    return;
  }
  const rows: Widget[] = [];
  for (let i = 0; i < cWebhooks.length; i++) {
    const w = cWebhooks[i];
    if (!w) continue;
    const sub = w.description && w.description.length > 0 ? w.description : plural(w.events.length, "{n} event", "{n} events");
    rows.push(
      item(iconTile("bolt.fill", w.active ? TILE_YELLOW : TILE_GRAY, 30), hostOf(w.url), sub, pill(w.active ? tr("Active") : tr("Paused"), w.active ? K_OK : K_NEUTRAL), true, () => {
        selWebhook = w;
        go(R_WEBHOOK);
      }),
    );
  }
  add(content, group(rows, 58));
}

function screenWebhook(seq: number, reload: boolean): void {
  const w = selWebhook;
  if (!w) {
    leave();
    return;
  }
  setBarHeader(tr("Webhook"), []);
  const rows: Widget[] = [];
  rows.push(infoItem(tr("Sends to"), w.url));
  if (w.description) rows.push(infoItem(tr("Note"), w.description));
  rows.push(infoItem(tr("Events"), w.events.join(", ")));
  rows.push(infoItem(tr("Status"), w.active ? tr("Active") : tr("Paused")));
  add(content, group(rows, 16));
  add(
    content,
    button(w.active ? tr("Pause deliveries") : tr("Resume deliveries"), w.active ? "pause.fill" : "play.fill", B_SECONDARY, 46, () => {
      void (async () => {
        setNotice(tr("Updating…"), 0);
        try {
          await api.setWebhookActive(w.id, !w.active);
          w.active = w.active ? 0 : 1;
          render(false);
          setNotice(w.active ? tr("Resumed") : tr("Paused"), 2);
        } catch (e) {
          fail(e);
        }
      })();
    }),
  );
  add(content, groupLabel(tr("Recent deliveries")));
  if (deliveriesFor === w.id && !reload) {
    drawDeliveries();
    return;
  }
  showSkeleton(seq, 4, false);
  void (async () => {
    try {
      cDeliveries = await api.listDeliveries(w.id);
      deliveriesFor = w.id;
    } catch (e) {
      if (isCurrent(seq)) fail(e);
      return;
    }
    if (!isCurrent(seq)) return;
    render(false);
  })();
}

/** Delivery timestamps arrive as ISO strings or as a raw driver object with `.raw`. */
function deliveryTime(d: WebhookDelivery): string {
  const c = d.createdAt;
  if (typeof c === "string") return relTime(c);
  if (c && typeof c === "object") {
    const raw = (c as { raw?: unknown }).raw;
    if (typeof raw === "string") return relTime(raw);
  }
  return "";
}

function drawDeliveries(): void {
  if (cDeliveries.length === 0) {
    const c = card(16, 0);
    add(c, caption(tr("Nothing has been sent yet.")));
    add(content, c);
    return;
  }
  const rows: Widget[] = [];
  for (let i = 0; i < cDeliveries.length; i++) {
    const d = cDeliveries[i];
    if (!d) continue;
    const parts: string[] = [];
    const when = deliveryTime(d);
    if (when.length > 0) parts.push(when);
    if (d.latencyMs !== null && d.latencyMs !== undefined) parts.push(`${d.latencyMs} ms`);
    if (d.error) parts.push(d.error);
    const status = d.responseStatus !== null && d.responseStatus !== undefined ? String(d.responseStatus) : d.succeeded ? "OK" : tr("Failed");
    rows.push(item(null, d.event, parts.join(" · "), pill(status, d.succeeded ? K_OK : K_DANGER), false, null));
  }
  add(content, group(rows, 16));
}

// ---------- jobs ---------------------------------------------------------

function screenJobs(seq: number, reload: boolean): void {
  setBarHeader(tr("Background jobs"), []);
  if (jobsLoaded && !reload) {
    drawJobs();
    return;
  }
  add(content, loadingBlock(""));
  void (async () => {
    try {
      cJobStats = await api.jobStats();
    } catch (e) {
      if (isCurrent(seq)) fail(e);
      return;
    }
    jobsListError = "";
    try {
      // Failures first: they are what needs a decision.
      const failed = await api.listJobs("failed", 50);
      const deadJobs = await api.listJobs("dead", 50);
      cJobs = failed.concat(deadJobs);
    } catch (e) {
      cJobs = [];
      jobsListError = errorMessage(e);
    }
    jobsLoaded = true;
    hJobsBad = (cJobStats["failed"] ?? 0) + (cJobStats["dead"] ?? 0);
    if (!isCurrent(seq)) return;
    widgetClearChildren(content);
    drawJobs();
  })();
}

function jobTile(label: string, n: number, c: Rgba): Widget {
  const t = card(14, 2);
  const num = text(String(n), 24, 700, n > 0 ? c : INK, 1);
  put(t, num);
  put(t, text(label, 12, 500, MUTED, 1));
  return t;
}

function drawJobs(): void {
  const keys = ["pending", "running", "done", "failed", "dead"];
  const names = [tr("Waiting"), tr("Running"), tr("Finished"), tr("Failed"), tr("Gave up")];
  const colors: Rgba[] = [INK, TILE_BLUE, OK_FG, WARN_FG, DANGER];
  const r1 = HStack(10, []);
  stackSetDistribution(r1, 1);
  const r2 = HStack(10, []);
  stackSetDistribution(r2, 1);
  for (let i = 0; i < keys.length; i++) {
    const n = cJobStats[keys[i] ?? ""];
    const tile = jobTile(names[i] ?? "", typeof n === "number" ? n : 0, colors[i] ?? INK);
    put(i < 3 ? r1 : r2, tile);
  }
  put(r2, VStack(0, []));
  add(content, r1);
  add(content, r2);
  add(content, groupLabel(tr("Needs attention")));
  if (jobsListError.length > 0) {
    add(content, banner(K_WARN, "exclamationmark.triangle.fill", tr("The job list couldn't be loaded: {error}", { error: jobsListError })));
    return;
  }
  if (cJobs.length === 0) {
    const c = card(16, 0);
    const r = hrow(12);
    put(r, softTile("checkmark", OK_FG, tintFill(TILE_GREEN), 36, true));
    put(r, grow(text(tr("No failed jobs. Everything ran fine."), 15, 500, INK, 0)));
    add(c, r);
    add(content, c);
    return;
  }
  const rows: Widget[] = [];
  for (let i = 0; i < cJobs.length; i++) {
    const j = cJobs[i];
    if (!j) continue;
    const kind = j.kind ?? j.queue ?? tr("Job #{id}", { id: j.id });
    const sub = `${j.status === "dead" ? tr("Gave up") : tr("Failed")} · ${plural(j.attempts, "{n} attempt", "{n} attempts")}${j.lastError ? ` · ${j.lastError}` : ""}`;
    rows.push(
      item(
        iconTile("exclamationmark.triangle.fill", j.status === "dead" ? TILE_RED : TILE_ORANGE, 30),
        kind,
        sub,
        chipButton(tr("Retry"), "arrow.clockwise", B_TINTED, () => {
          void (async () => {
            setNotice(tr("Retrying…"), 0);
            try {
              await api.retryJob(j.id);
              render(true);
              setNotice(tr("Queued again"), 2);
            } catch (e) {
              fail(e);
            }
          })();
        }),
        false,
        null,
      ),
    );
  }
  add(content, group(rows, 58));
}

// ---------- users --------------------------------------------------------

let inviteEmail = "";
let inviteName = "";
let inviteRole = -1;

function screenUsers(seq: number, reload: boolean): void {
  setBarHeader(tr("Team"), can("manageUsers") ? [headerAction("person.badge.plus", tr("Invite"), () => go(R_INVITE))] : []);
  if (usersLoaded && !reload) {
    drawUsers();
    return;
  }
  showSkeleton(seq, 5, true);
  void (async () => {
    try {
      cUsers = await api.listUsers();
      try {
        cRoles = await api.listRoles();
      } catch {
        cRoles = [];
      }
      usersLoaded = true;
    } catch (e) {
      if (isCurrent(seq)) fail(e);
      return;
    }
    if (!isCurrent(seq)) return;
    widgetClearChildren(content);
    drawUsers();
  })();
}

function userMenu(u: UserListItem): void {
  const suspended = u.status === "suspended";
  const run = (): void => {
    void (async () => {
      setNotice(tr("Updating…"), 0);
      try {
        if (suspended) await api.unsuspendUser(u.id);
        else await api.suspendUser(u.id);
        render(true);
        setNotice(suspended ? tr("Access restored") : tr("Suspended"), 2);
      } catch (e) {
        fail(e);
      }
    })();
  };
  const labels: string[] = [];
  const handlers: (() => void)[] = [];
  labels.push(tr("Email {name}", { name: firstName(u.displayName) }));
  handlers.push(() => openURL(`mailto:${u.email}`));
  if (suspended) {
    labels.push(tr("Restore access"));
    handlers.push(run);
  } else {
    labels.push(tr("Suspend access"));
    handlers.push(() => confirm(tr("Suspend this person?"), tr("{name} is signed out everywhere and can't sign in until restored.", { name: u.displayName }), tr("Suspend"), run));
  }
  actionMenu(u.displayName, labels, handlers);
}

function drawUsers(): void {
  const myId = me ? me.user.id : -1;
  const rows: Widget[] = [];
  for (let i = 0; i < cUsers.length; i++) {
    const u = cUsers[i];
    if (!u) continue;
    const role = u.roleLabel ?? u.roleSlug ?? "";
    const trailing = column(4);
    if (role.length > 0) put(trailing, tag(role));
    if (u.status !== "active") put(trailing, pill(u.status === "invited" ? tr("Invited") : u.status === "suspended" ? tr("Suspended") : u.status, u.status === "suspended" ? K_DANGER : K_WARN));
    widgetSetHugging(trailing, 750);
    const isMe = u.id === myId;
    rows.push(item(avatar(u.displayName, u.email, 40), isMe ? tr("{name} (you)", { name: u.displayName }) : u.displayName, u.email, trailing, false, isMe ? null : () => userMenu(u)));
  }
  add(content, group(rows, 68));
  if (cRoles.length > 0) {
    add(content, button(tr("Invite someone"), "person.badge.plus", B_SECONDARY, 46, () => go(R_INVITE)));
  }
}

function screenInvite(): void {
  setBarHeader(tr("Invite"), []);
  const form = card(16, 16);
  add(
    form,
    field(
      tr("Name"),
      null,
      input(tr("Full name"), inviteName, false, "person", (s: string) => {
        inviteName = s;
      }),
      "",
    ),
  );
  add(
    form,
    field(
      tr("Email"),
      null,
      input(tr("name@example.com"), inviteEmail, false, "envelope", (s: string) => {
        inviteEmail = s;
      }),
      "",
    ),
  );
  const labels: string[] = [];
  for (let i = 0; i < cRoles.length; i++) labels.push((cRoles[i] ?? { label: "" }).label);
  if (labels.length > 0) {
    add(
      form,
      field(
        tr("Role"),
        null,
        chips(labels, inviteRole >= 0 ? [inviteRole] : [], false, (sel: number[]) => {
          inviteRole = sel[0] ?? -1;
        }),
        "",
      ),
    );
  }
  add(content, form);
  add(content, footnote(tr("They get an email with a link to set their password.")));
  setActions([
    button(tr("Send invitation"), "paperplane.fill", B_PRIMARY, AB_H, () => {
      void (async () => {
        const email = inviteEmail.trim().toLowerCase();
        const name = inviteName.trim();
        const role = cRoles[inviteRole];
        if (email.length === 0 || name.length === 0 || !role) {
          setNotice(tr("Enter a name and an email, and pick a role."), 1);
          return;
        }
        setNotice(tr("Sending…"), 0);
        try {
          await api.inviteUser(email, name, role.id);
          inviteEmail = "";
          inviteName = "";
          inviteRole = -1;
          usersLoaded = false;
          leave();
          setNotice(tr("Invitation sent"), 2);
        } catch (e) {
          fail(e);
        }
      })();
    }),
  ]);
}

// ---------- account ------------------------------------------------------

let newPassword = "";
let newPassword2 = "";

function screenAccount(): void {
  setBarHeader(tr("Account"), []);
  const who = me;
  if (!who) return;
  const head = centerColumn(6);
  setPadding(head, 8, 0, 6, 0);
  put(head, avatar(who.user.displayName, who.user.email, 76));
  put(head, gap(4));
  put(head, text(who.user.displayName, 22, 700, INK, 1));
  put(head, text(who.user.email, 15, 400, MUTED, 1));
  add(content, head);

  add(
    content,
    group([infoItem(tr("Role"), who.user.role.label), infoItem(tr("Site"), hostOf(api.getBaseUrl())), infoItem(tr("Language"), who.user.locale.toUpperCase())], 16),
  );

  add(content, groupLabel(tr("Change password")));
  const pw = card(16, 14);
  add(
    pw,
    field(
      tr("New password"),
      null,
      input(tr("At least 12 characters"), "", true, "lock", (s: string) => {
        newPassword = s;
      }),
      "",
    ),
  );
  add(
    pw,
    field(
      tr("Repeat new password"),
      null,
      input(tr("Repeat it"), "", true, "lock", (s: string) => {
        newPassword2 = s;
      }),
      tr("Changing it signs you out on every device."),
    ),
  );
  add(
    pw,
    button(tr("Change password"), "", B_SECONDARY, 46, () => {
      void (async () => {
        if (newPassword.length < 12) {
          setNotice(tr("Use at least 12 characters."), 1);
          return;
        }
        if (newPassword !== newPassword2) {
          setNotice(tr("The two passwords don't match."), 1);
          return;
        }
        setNotice(tr("Changing…"), 0);
        try {
          await api.changeOwnProfile(who.user.id, { password: newPassword });
          newPassword = "";
          newPassword2 = "";
          // The CMS signs every device out when the password changes.
          endSession(tr("Password changed. Sign in with the new one."));
        } catch (e) {
          fail(e);
        }
      })();
    }),
  );
  add(content, pw);
  add(
    content,
    group(
      [
        actionItem(null, tr("Sign out"), DANGER, () => {
          confirm(tr("Sign out?"), tr("You'll need your password to sign in to {site} again.", { site: siteName(api.getBaseUrl()) }), tr("Sign out"), () => {
            void doSignOut();
          });
        }),
      ],
      16,
    ),
  );
}

// ---------- app ----------------------------------------------------------

widgetSetHidden(noticeWrap, 1);
widgetSetHidden(actionBar, 1);
widgetSetHidden(tabWrap, 1);

if (isIOS) {
  scrollviewSetRefreshControl(scroll, () => {
    const r = currentRoute();
    if (r !== R_SIGNIN && r !== R_EDITOR && r !== R_NEW && r !== R_UPLOAD && r !== R_SETTING && r !== R_INVITE && r !== R_MENU_ADD && r !== R_REDIRECT_ADD) {
      render(true);
    }
    setTimeout(() => scrollviewEndRefreshing(scroll), 600);
  });
}

// Desktop keyboard shortcuts (registered before App(), as perry/ui requires).
addKeyboardShortcut("s", 1, () => {
  if (currentRoute() === R_EDITOR) void doSave(false);
});
addKeyboardShortcut("n", 1, () => {
  const t = selType;
  if (currentRoute() === R_CONTENT && t && canType(t.slug, "create")) startNewItem(t);
});
addKeyboardShortcut("r", 1, () => {
  if (currentRoute() !== R_SIGNIN) render(true);
});
addKeyboardShortcut("[", 1, () => goBack());
// ⌘1–⌘4 jump between the main sections, ⌘, opens Settings (desktop).
const SHORTCUT_ROOTS = [R_HOME, R_TYPES, R_MEDIA, R_FORMS];
for (let i = 0; i < SHORTCUT_ROOTS.length; i++) {
  const route = SHORTCUT_ROOTS[i] ?? R_HOME;
  addKeyboardShortcut(String(i + 1), 1, () => {
    if (me) navRoot(route);
  });
}
addKeyboardShortcut(",", 1, () => {
  if (me && can("manageSettings")) navRoot(R_SETTINGS);
});

void boot();

App({
  title: "Skelpo CMS",
  width: isMobile ? 390 : 1240,
  height: isMobile ? 844 : 820,
  body: root,
});
