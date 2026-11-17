// Skelpo CMS Admin — design system.
//
// Tokens (colour, type, spacing) and the reusable components every screen is
// built from. Everything here is plain perry/ui widgets styled imperatively,
// so it renders the same on iOS, macOS and Android.
//
// The palette is picked once at launch from the system appearance
// (`isDarkMode()`): perry/ui's appearance-adaptive colours are macOS-only, so
// the app follows the setting it was opened with.
import {
  HStack,
  ImageSymbol,
  ProgressView,
  SecureField,
  Spacer,
  Text,
  TextArea,
  TextField,
  VStack,
  setCornerRadius,
  setPadding,
  stackSetAlignment,
  stackSetDistribution,
  textSetColor,
  textSetFontSize,
  textSetFontWeight,
  textSetLetterSpacing,
  textSetNumberOfLines,
  textSetString,
  textSetTextAlignment,
  textSetWraps,
  textareaSetString,
  textfieldSetBorderless,
  textfieldSetFontSize,
  textfieldSetString,
  textfieldSetTextColor,
  textfieldSetBackgroundColor,
  imageSetTint,
  widgetAddChild,
  widgetAnimateOpacity,
  widgetMatchParentWidth,
  widgetSetBackgroundColor,
  widgetSetBackgroundGradient,
  widgetSetBorderColor,
  widgetSetBorderWidth,
  widgetSetHeight,
  widgetSetHugging,
  widgetSetOnClick,
  widgetSetOnHover,
  widgetSetOpacity,
  widgetSetShadow,
  widgetSetWidth,
} from "perry/ui";
import type { Widget } from "perry/ui";
import { hapticPlay, isDarkMode } from "perry/system";
import { tr } from "./i18n.js";

/** Compile-time platform id: 0 macOS, 1 iOS, 2 Android, 3 Windows, 4 Linux. */
declare const __platform__: number;
export const isIOS = __platform__ === 1;
export const isAndroid = __platform__ === 2;
export const isMobile = isIOS || isAndroid;
/** Desktop layout: sidebar, toolbar actions, hover states, wider grids. */
export const isDesktop = !isMobile;

// ---------- colour -------------------------------------------------------

export type Rgba = readonly [number, number, number, number];

export const dark = isDarkMode();

function hex(h: number, a: number): Rgba {
  return [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255, a];
}
function pick(light: number, darkHex: number): Rgba {
  return hex(dark ? darkHex : light, 1);
}

/** Window background behind cards. */
export const BG = pick(0xf1f1f3, 0x0c0c0e);
/** Cards, header, bars. */
export const SURFACE = pick(0xffffff, 0x1b1c20);
/** Inputs, segmented track, placeholders. */
export const SURFACE2 = pick(0xf3f3f5, 0x26272c);
/** Pressed / selected-row tint. */
export const SURFACE3 = pick(0xe9e9ed, 0x303137);
export const HAIRLINE = pick(0xe3e4e8, 0x2d2e34);

export const INK = pick(0x111216, 0xf5f5f7);
export const BODY = pick(0x3d4048, 0xc9cbd1);
export const MUTED = pick(0x767983, 0x8d909a);
export const FAINT = pick(0xa4a7b0, 0x5f626b);

/** Skelpo orange. Brand moments: logo, hero, accents. */
export const BRAND = hex(0xf58113, 1);
export const BRAND_DEEP = hex(0xd8650a, 1);
/** Orange that passes contrast as text on SURFACE. */
export const BRAND_INK = pick(0xc25500, 0xff9d45);
export const BRAND_TINT = pick(0xfff1e3, 0x3a2512);

/** Primary buttons: ink on light, near-white on dark (Shopify-style). */
export const PRIMARY = pick(0x17181c, 0xf5f5f7);
export const ON_PRIMARY = pick(0xffffff, 0x111216);
export const WHITE: Rgba = [1, 1, 1, 1];

export const OK_FG = pick(0x0b7a42, 0x4ade80);
export const OK_BG = pick(0xe2f5e9, 0x123222);
export const WARN_FG = pick(0x8a5a00, 0xfbbf24);
export const WARN_BG = pick(0xfff3d1, 0x352a0e);
export const DANGER = pick(0xc8281b, 0xff6b5e);
export const DANGER_BG = pick(0xfde7e4, 0x3b1715);
export const INFO_FG = pick(0x2456c6, 0x7ea6ff);
export const INFO_BG = pick(0xe7eefd, 0x15244a);

/** Icon-tile colours (iOS Settings style). */
export const TILE_ORANGE = hex(0xf58113, 1);
export const TILE_BLUE = hex(0x2f7cf6, 1);
export const TILE_GREEN = hex(0x22a55b, 1);
export const TILE_PURPLE = hex(0x8b5cf6, 1);
export const TILE_PINK = hex(0xec4899, 1);
export const TILE_TEAL = hex(0x0ea5a4, 1);
export const TILE_INDIGO = hex(0x5b5bd6, 1);
export const TILE_GRAY = hex(0x8e8e93, 1);
export const TILE_RED = hex(0xef4444, 1);
export const TILE_YELLOW = hex(0xeab308, 1);

const AVATAR_COLORS: Rgba[] = [TILE_ORANGE, TILE_BLUE, TILE_GREEN, TILE_PURPLE, TILE_PINK, TILE_TEAL, TILE_INDIGO, TILE_RED];

// ---------- metrics ------------------------------------------------------

export const PAD = 16;
export const RADIUS = 16;
/** A one-device-pixel line on retina phones. */
export const HAIR = isIOS ? 0.5 : 1;

// ---------- primitives ---------------------------------------------------

export function bg(w: Widget, c: Rgba): void {
  widgetSetBackgroundColor(w, c[0], c[1], c[2], c[3]);
}
export function strokeColor(w: Widget, c: Rgba, width: number): void {
  widgetSetBorderColor(w, c[0], c[1], c[2], c[3]);
  widgetSetBorderWidth(w, width);
}
export function color(t: Widget, c: Rgba): void {
  textSetColor(t, c[0], c[1], c[2], c[3]);
}
/** Soft elevation used by cards; set after the corner radius. */
export function elevate(w: Widget, level: number): void {
  if (dark) return;
  if (level >= 2) widgetSetShadow(w, 0.05, 0.06, 0.12, 0.12, 18, 0, 6);
  else widgetSetShadow(w, 0.05, 0.06, 0.12, 0.06, 10, 0, 2);
}

/**
 * A text label. `weight` 400 regular, 500 medium, 600 semibold, 700 bold.
 * `lines` 0 wraps freely, n > 0 caps the line count (tail ellipsis).
 */
/** CSS-style weight (400…800) → UIFont/NSFont weight (-1…1). */
function fontWeight(w: number): number {
  if (w >= 800) return 0.56;
  if (w >= 700) return 0.4;
  if (w >= 600) return 0.3;
  if (w >= 500) return 0.23;
  return 0;
}
export function text(s: string, size: number, weight: number, c: Rgba, lines: number): Widget {
  const t = Text(s);
  if (weight > 400) textSetFontWeight(t, size, fontWeight(weight));
  else textSetFontSize(t, size);
  color(t, c);
  if (lines === 0) textSetWraps(t, 0);
  else textSetNumberOfLines(t, lines);
  return t;
}
export function largeTitle(s: string): Widget {
  const t = text(s, 32, 700, INK, 1);
  textSetLetterSpacing(t, -0.6);
  return t;
}
export function title2(s: string): Widget {
  const t = text(s, 22, 700, INK, 0);
  textSetLetterSpacing(t, -0.3);
  return t;
}
export function headline(s: string): Widget {
  return text(s, 16, 600, INK, 0);
}
export function bodyText(s: string): Widget {
  return text(s, 15, 400, BODY, 0);
}
export function caption(s: string): Widget {
  return text(s, 13, 400, MUTED, 0);
}
/** Text centred horizontally and vertically in a flexible box of `height`. */
export function centeredLabel(t: Widget, height: number, size: number): Widget {
  textSetTextAlignment(t, 2);
  return centerBox(t, 0, height, lineH(size));
}
export function centered(t: Widget): Widget {
  textSetTextAlignment(t, 2);
  return t;
}

/** Vertical stack, children on the leading edge. Use `add()` to stretch one. */
export function column(spacing: number): Widget {
  const v = VStack(spacing, []);
  stackSetAlignment(v, 5);
  return v;
}
/** Horizontal stack, children centred vertically. */
export function hrow(spacing: number): Widget {
  const h = HStack(spacing, []);
  stackSetAlignment(h, 10);
  return h;
}
/** Vertical stack, children centred horizontally. */
export function centerColumn(spacing: number): Widget {
  const v = VStack(spacing, []);
  stackSetAlignment(v, 9);
  return v;
}
/** Append and stretch to the parent's width. */
export function add(parent: Widget, child: Widget): void {
  widgetAddChild(parent, child);
  widgetMatchParentWidth(child);
}
export function put(parent: Widget, child: Widget): void {
  widgetAddChild(parent, child);
}
export function fixed(w: Widget, width: number, height: number): Widget {
  if (width > 0) widgetSetWidth(w, width);
  if (height > 0) widgetSetHeight(w, height);
  widgetSetHugging(w, 750);
  return w;
}
export function grow(w: Widget): Widget {
  widgetSetHugging(w, 1);
  return w;
}
export function gap(height: number): Widget {
  const v = VStack(0, []);
  widgetSetHeight(v, height);
  return v;
}

/** Tap handler with a press flash and a light haptic tick. */
export function onTap(w: Widget, run: () => void): void {
  widgetSetOnClick(w, () => {
    widgetSetOpacity(w, 0.55);
    setTimeout(() => widgetAnimateOpacity(w, 1, 0.22), 90);
    if (isMobile) hapticPlay("selection");
    run();
  });
}
/** Desktop: tint the background while the pointer is over `w`. */
export function hoverTint(w: Widget, rest: Rgba): void {
  if (!isDesktop) return;
  widgetSetOnHover(w, (on: boolean) => bg(w, on ? SURFACE2 : rest));
}
/** Desktop: dim slightly while hovered (buttons, tiles). */
export function hoverDim(w: Widget): void {
  if (!isDesktop) return;
  widgetSetOnHover(w, (on: boolean) => widgetSetOpacity(w, on ? 0.86 : 1));
}
export function haptic(kind: "success" | "error" | "warning" | "light"): void {
  if (isMobile) hapticPlay(kind);
}

// ---------- icons --------------------------------------------------------

export function symbol(name: string, size: number, c: Rgba): Widget {
  const s = ImageSymbol(name);
  widgetSetWidth(s, size);
  widgetSetHeight(s, size);
  widgetSetHugging(s, 750);
  imageSetTint(s, c[0], c[1], c[2], c[3]);
  return s;
}

/**
 * `child` centred in a box of `height` (and `width`, 0 = flexible).
 * Horizontal centring comes from a centre-aligned VStack; vertical centring
 * from a computed top inset (`contentH` = the child's height) with a Spacer
 * soaking up rounding slack. Two flexible spacers around a view are
 * ambiguous to both NSStackView and UIStackView, so they don't centre.
 */
function centerBox(child: Widget, width: number, height: number, contentH: number): Widget {
  const box = VStack(0, [child, Spacer()]);
  stackSetAlignment(box, 9);
  setPadding(box, Math.max(0, Math.floor((height - contentH) / 2)), 0, 0, 0);
  if (width > 0) widgetSetWidth(box, width);
  widgetSetHeight(box, height);
  widgetSetHugging(box, 750);
  return box;
}
/** Line height of the system font at `size` (for centring text). */
function lineH(size: number): number {
  return Math.round(size * 1.2);
}
/**
 * Wrap a clipped, rounded widget so it can cast a shadow: a shadow turns
 * off the layer's clipping, which would square off gradients and images.
 */
function shadowed(inner: Widget, level: number, matchWidth: boolean): Widget {
  const wrap = VStack(0, [inner]);
  stackSetAlignment(wrap, 5);
  if (matchWidth) widgetMatchParentWidth(inner);
  elevate(wrap, level);
  return wrap;
}

/** White glyph on a solid rounded square. */
export function iconTile(name: string, tint: Rgba, size: number): Widget {
  const g = Math.round(size * 0.56);
  const box = centerBox(symbol(name, g, WHITE), size, size, g);
  bg(box, tint);
  setCornerRadius(box, Math.round(size * 0.28));
  return box;
}
/** Coloured glyph on a tinted rounded square. */
export function softTile(name: string, fg: Rgba, fill: Rgba, size: number, round: boolean): Widget {
  const g = Math.round(size * 0.5);
  const box = centerBox(symbol(name, g, fg), size, size, g);
  bg(box, fill);
  setCornerRadius(box, round ? size / 2 : Math.round(size * 0.28));
  return box;
}

function initials(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/);
  let out = "";
  for (let i = 0; i < parts.length && out.length < 2; i++) {
    const p = parts[i] ?? "";
    if (p.length > 0) out += p.charAt(0).toUpperCase();
  }
  return out.length > 0 ? out : "?";
}
function hashOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100003;
  return h;
}
export function avatarColor(seed: string): Rgba {
  return AVATAR_COLORS[hashOf(seed) % AVATAR_COLORS.length] ?? TILE_ORANGE;
}
/** Initials in a coloured circle. */
export function avatar(name: string, seed: string, size: number): Widget {
  const fs = Math.round(size * 0.38);
  const t = text(initials(name), fs, 600, WHITE, 1);
  const box = centerBox(t, size, size, lineH(fs));
  bg(box, avatarColor(seed.length > 0 ? seed : name));
  setCornerRadius(box, size / 2);
  return box;
}

/** The Skelpo mark inverted: orange "S" on white (for the brand gradient). */
export function logoMarkWhite(size: number): Widget {
  const fs = Math.round(size * 0.56);
  const t = text("S", fs, 800, BRAND, 1);
  const box = centerBox(t, size, size, lineH(fs));
  bg(box, WHITE);
  setCornerRadius(box, Math.round(size * 0.26));
  const wrap = VStack(0, [box]);
  widgetSetShadow(wrap, 0.4, 0.15, 0, 0.25, 16, 0, 6);
  return wrap;
}
/** Any widget centred in a fixed-size box. */
export function boxed(child: Widget, width: number, height: number, contentH: number): Widget {
  return centerBox(child, width, height, contentH);
}

/** The Skelpo mark: white "S" on an orange rounded square. */
export function logoMark(size: number): Widget {
  const fs = Math.round(size * 0.56);
  const t = text("S", fs, 800, WHITE, 1);
  const box = centerBox(t, size, size, lineH(fs));
  widgetSetBackgroundGradient(box, BRAND[0], BRAND[1], BRAND[2], 1, BRAND_DEEP[0], BRAND_DEEP[1], BRAND_DEEP[2], 1, 135);
  setCornerRadius(box, Math.round(size * 0.26));
  return shadowed(box, 2, false);
}

// ---------- surfaces -----------------------------------------------------

export function card(padding: number, spacing: number): Widget {
  const v = column(spacing);
  bg(v, SURFACE);
  setCornerRadius(v, RADIUS);
  if (dark) strokeColor(v, HAIRLINE, HAIR);
  elevate(v, 1);
  setPadding(v, padding, padding, padding, padding);
  return v;
}

export function divider(inset: number): Widget {
  const line = HStack(0, []);
  widgetSetHeight(line, HAIR);
  bg(line, HAIRLINE);
  const wrap = HStack(0, [line]);
  setPadding(wrap, 0, inset, 0, 0);
  widgetMatchParentWidth(line);
  return wrap;
}

/**
 * An inset-grouped list: rows in one card separated by hairlines.
 * `inset` is the divider's leading indent (align it with the row text).
 */
export function group(rows: Widget[], inset: number): Widget {
  const v = column(0);
  bg(v, SURFACE);
  setCornerRadius(v, RADIUS);
  if (dark) strokeColor(v, HAIRLINE, HAIR);
  elevate(v, 1);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    if (i > 0) add(v, divider(inset));
    add(v, r);
  }
  return v;
}

/** Section heading above a group or card, with an optional trailing link. */
export function sectionHeader(title: string, linkLabel: string, link: (() => void) | null): Widget {
  const h = hrow(8);
  setPadding(h, 10, 4, 0, 4);
  put(h, grow(text(title, 17, 700, INK, 1)));
  if (link && linkLabel.length > 0) {
    const l = text(linkLabel, 15, 600, BRAND_INK, 1);
    const box = HStack(0, [l]);
    setPadding(box, 6, 8, 6, 0);
    widgetSetHugging(box, 750);
    onTap(box, link);
    put(h, box);
  }
  return h;
}
/** Small muted label above a group of form fields (iOS style). */
export function groupLabel(title: string): Widget {
  const t = text(title.toUpperCase(), 12, 600, MUTED, 1);
  textSetLetterSpacing(t, 0.4);
  const box = HStack(0, [t]);
  setPadding(box, 14, 6, 0, 6);
  return box;
}
export function footnote(s: string): Widget {
  const t = text(s, 13, 400, MUTED, 0);
  const box = HStack(0, [t]);
  setPadding(box, 0, 6, 0, 6);
  widgetMatchParentWidth(t);
  return box;
}

/**
 * One list row: optional leading widget, title + subtitle, optional trailing
 * widget, optional chevron. `run` null = static row.
 */
export function item(
  lead: Widget | null,
  title: string,
  subtitle: string,
  trailing: Widget | null,
  chevron: boolean,
  run: (() => void) | null,
): Widget {
  const r = hrow(12);
  setPadding(r, 12, 16, 12, 14);
  if (lead) put(r, lead);
  const texts = column(2);
  put(texts, text(title.length > 0 ? title : tr("Untitled"), 16, 500, INK, 2));
  if (subtitle.length > 0) put(texts, text(subtitle, 13, 400, MUTED, 2));
  put(r, grow(texts));
  if (trailing) put(r, trailing);
  if (chevron) put(r, symbol("chevron.right", 13, FAINT));
  if (run) {
    onTap(r, run);
    hoverTint(r, [0, 0, 0, 0]);
  }
  return r;
}
/** A row whose title is an action (e.g. "Sign out"), coloured. */
export function actionItem(lead: Widget | null, title: string, c: Rgba, run: () => void): Widget {
  const r = hrow(12);
  setPadding(r, 14, 16, 14, 14);
  if (lead) put(r, lead);
  put(r, grow(text(title, 16, 500, c, 1)));
  onTap(r, run);
  hoverTint(r, [0, 0, 0, 0]);
  return r;
}
/** Key on the left, value on the right; long values wrap below. */
export function infoItem(key: string, value: string): Widget {
  const v = value.length > 0 ? value : "—";
  if (v.length > 28 || v.indexOf("\n") >= 0) {
    const c = column(3);
    setPadding(c, 12, 16, 12, 16);
    put(c, text(key, 13, 400, MUTED, 1));
    add(c, text(v, 15, 400, INK, 0));
    return c;
  }
  const r = hrow(12);
  setPadding(r, 13, 16, 13, 16);
  put(r, grow(text(key, 15, 400, MUTED, 1)));
  const val = text(v, 15, 500, INK, 1);
  textSetTextAlignment(val, 1);
  put(r, val);
  return r;
}

// ---------- pills & badges -----------------------------------------------

export const K_NEUTRAL = 0;
export const K_OK = 1;
export const K_WARN = 2;
export const K_DANGER = 3;
export const K_INFO = 4;
export const K_BRAND = 5;

function kindColors(kind: number): { fg: Rgba; fill: Rgba } {
  if (kind === K_OK) return { fg: OK_FG, fill: OK_BG };
  if (kind === K_WARN) return { fg: WARN_FG, fill: WARN_BG };
  if (kind === K_DANGER) return { fg: DANGER, fill: DANGER_BG };
  if (kind === K_INFO) return { fg: INFO_FG, fill: INFO_BG };
  if (kind === K_BRAND) return { fg: BRAND_INK, fill: BRAND_TINT };
  return { fg: BODY, fill: SURFACE2 };
}

/** Rounded status pill with a leading dot. */
export function pill(label: string, kind: number): Widget {
  const k = kindColors(kind);
  const dot = HStack(0, []);
  widgetSetWidth(dot, 6);
  widgetSetHeight(dot, 6);
  bg(dot, k.fg);
  setCornerRadius(dot, 3);
  const box = hrow(5);
  put(box, dot);
  put(box, text(label, 12, 600, k.fg, 1));
  bg(box, k.fill);
  setCornerRadius(box, 11);
  setPadding(box, 3, 8, 3, 9);
  widgetSetHugging(box, 750);
  return box;
}
/** Small text tag, e.g. a language code. */
export function tag(label: string): Widget {
  const box = HStack(0, [text(label, 11, 600, MUTED, 1)]);
  bg(box, SURFACE2);
  setCornerRadius(box, 5);
  setPadding(box, 2, 6, 2, 6);
  widgetSetHugging(box, 750);
  return box;
}

// ---------- buttons ------------------------------------------------------

export const B_PRIMARY = 0;
export const B_SECONDARY = 1;
export const B_TINTED = 2;
export const B_DANGER = 3;
export const B_PLAIN = 4;
export const B_BRAND = 5;
/** White button on the brand gradient. */
export const B_ON_BRAND = 6;
/** Translucent white button on the brand gradient. */
export const B_GHOST_ON_BRAND = 7;

/**
 * A button drawn from stacks so its type matches the rest of the UI.
 * `icon` "" = none. `height` 50 regular, 40 compact, 34 small.
 */
export function button(label: string, icon: string, variant: number, height: number, run: () => void): Widget {
  let fill: Rgba = PRIMARY;
  let fg: Rgba = ON_PRIMARY;
  let outline = false;
  if (variant === B_SECONDARY) {
    fill = SURFACE;
    fg = INK;
    outline = true;
  } else if (variant === B_TINTED) {
    fill = SURFACE2;
    fg = INK;
  } else if (variant === B_DANGER) {
    fill = DANGER_BG;
    fg = DANGER;
  } else if (variant === B_PLAIN) {
    fill = [0, 0, 0, 0];
    fg = BRAND_INK;
  } else if (variant === B_BRAND) {
    fill = BRAND;
    fg = WHITE;
  } else if (variant === B_ON_BRAND) {
    fill = WHITE;
    fg = hex(0xb84f00, 1);
  } else if (variant === B_GHOST_ON_BRAND) {
    fill = [1, 1, 1, 0.2];
    fg = WHITE;
  }
  const size = height >= 46 ? 16 : height >= 38 ? 15 : 14;
  const row = hrow(7);
  if (icon.length > 0) put(row, symbol(icon, size + 1, fg));
  put(row, text(label, size, 600, fg, 1));
  widgetSetHugging(row, 750);
  const box = centerBox(row, 0, height, lineH(size));
  const hp = height >= 46 ? 18 : 14;
  setPadding(box, Math.max(0, Math.floor((height - lineH(size)) / 2)), hp, 0, hp);
  widgetSetHugging(box, 250);
  bg(box, fill);
  setCornerRadius(box, height >= 46 ? 14 : height / 2.6);
  if (outline) strokeColor(box, HAIRLINE, 1);
  onTap(box, run);
  hoverDim(box);
  return box;
}
/** A button that hugs its content (for rows of actions). */
export function chipButton(label: string, icon: string, variant: number, run: () => void): Widget {
  const b = button(label, icon, variant, 36, run);
  widgetSetHugging(b, 750);
  return b;
}
/** A round tappable icon (header actions). */
export function iconButton(name: string, c: Rgba, run: () => void): Widget {
  const box = centerBox(symbol(name, 21, c), 38, 38, 21);
  setCornerRadius(box, 19);
  onTap(box, run);
  return box;
}
/**
 * Compact formatting-bar button: an SF Symbol, or a short text label such as
 * "H2" when `icon` is empty.
 */
export function toolButton(icon: string, label: string, c: Rgba, run: () => void): Widget {
  const inner = icon.length > 0 ? symbol(icon, 15, c) : text(label, 13, 700, c, 1);
  const box = centerBox(inner, 32, 30, icon.length > 0 ? 15 : lineH(13));
  setCornerRadius(box, 7);
  onTap(box, run);
  hoverTint(box, [0, 0, 0, 0]);
  return box;
}
/** A horizontal row of equal-width buttons. */
export function buttonRow(buttons: Widget[]): Widget {
  const r = HStack(10, []);
  stackSetDistribution(r, 1);
  for (let i = 0; i < buttons.length; i++) {
    const b = buttons[i];
    if (b) put(r, b);
  }
  return r;
}

// ---------- selection controls ------------------------------------------

/** iOS-style segmented control; restyles itself in place (no re-render). */
export function segmented(labels: string[], selected: number, onSelect: (index: number) => void): Widget {
  const track = HStack(2, []);
  stackSetDistribution(track, 1);
  bg(track, SURFACE3);
  setCornerRadius(track, 11);
  setPadding(track, 3, 3, 3, 3);
  const boxes: Widget[] = [];
  const texts: Widget[] = [];
  const paint = (sel: number): void => {
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const t = texts[i];
      if (!b || !t) continue;
      if (i === sel) {
        bg(b, SURFACE);
        if (!dark) widgetSetShadow(b, 0, 0, 0, 0.1, 4, 0, 1);
        color(t, INK);
      } else {
        bg(b, [0, 0, 0, 0]);
        widgetSetShadow(b, 0, 0, 0, 0, 0, 0, 0);
        color(t, MUTED);
      }
    }
  };
  for (let i = 0; i < labels.length; i++) {
    const index = i;
    const t = text(labels[i] ?? "", 13, 600, MUTED, 1);
    textSetTextAlignment(t, 2);
    const b = centerBox(t, 0, 32, lineH(13));
    setCornerRadius(b, 8);
    widgetSetOnClick(b, () => {
      if (isMobile) hapticPlay("selection");
      paint(index);
      onSelect(index);
    });
    boxes.push(b);
    texts.push(t);
    put(track, b);
  }
  paint(selected);
  return track;
}

/**
 * Wrapping pill chips. `multi` false = single choice (tapping the selected
 * one keeps it); true = each chip toggles. Restyles in place and reports the
 * full selection.
 */
export function chips(labels: string[], selected: number[], multi: boolean, onChange: (selection: number[]) => void): Widget {
  const rows = column(8);
  let row = HStack(8, []);
  let used = 0;
  const boxes: Widget[] = [];
  const texts: Widget[] = [];
  const icons: Widget[] = [];
  let sel: number[] = selected.slice(0);
  const paint = (): void => {
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const t = texts[i];
      const ic = icons[i];
      if (!b || !t || !ic) continue;
      const on = sel.indexOf(i) >= 0;
      bg(b, on ? PRIMARY : SURFACE);
      strokeColor(b, on ? PRIMARY : HAIRLINE, 1);
      color(t, on ? ON_PRIMARY : BODY);
      widgetSetOpacity(ic, on ? 1 : 0);
      widgetSetWidth(ic, on && multi ? 13 : 0);
    }
  };
  for (let i = 0; i < labels.length; i++) {
    const index = i;
    const s = labels[i] ?? "";
    const width = s.length * 7.6 + 34 + (multi ? 14 : 0);
    if (used > 0 && used + width > (isDesktop ? 900 : 340)) {
      put(row, Spacer());
      add(rows, row);
      row = HStack(8, []);
      used = 0;
    }
    const ic = symbol("checkmark", 12, ON_PRIMARY);
    const t = text(s, 14, 500, BODY, 1);
    const b = hrow(5);
    put(b, ic);
    put(b, t);
    widgetSetHeight(b, 34);
    setCornerRadius(b, 17);
    setPadding(b, 0, 14, 0, 14);
    widgetSetHugging(b, 750);
    widgetSetOnClick(b, () => {
      if (isMobile) hapticPlay("selection");
      if (multi) {
        const at = sel.indexOf(index);
        if (at >= 0) sel.splice(at, 1);
        else sel.push(index);
      } else {
        sel = [index];
      }
      paint();
      onChange(sel.slice(0));
    });
    boxes.push(b);
    texts.push(t);
    icons.push(ic);
    put(row, b);
    used += width + 8;
  }
  put(row, Spacer());
  add(rows, row);
  paint();
  return rows;
}

// ---------- inputs -------------------------------------------------------

/** A filled, borderless text input with an optional leading SF Symbol. */
export function input(placeholder: string, value: string, secure: boolean, icon: string, onChange: (s: string) => void): Widget {
  const box = hrow(10);
  bg(box, SURFACE2);
  setCornerRadius(box, 12);
  setPadding(box, 0, 14, 0, 14);
  widgetSetHeight(box, 50);
  if (icon.length > 0) put(box, symbol(icon, 17, MUTED));
  const f = secure ? SecureField(placeholder, onChange) : TextField(placeholder, onChange);
  textfieldSetBorderless(f, 1);
  textfieldSetBackgroundColor(f, 0, 0, 0, 0);
  textfieldSetFontSize(f, 16);
  textfieldSetTextColor(f, INK[0], INK[1], INK[2], 1);
  if (value.length > 0) textfieldSetString(f, value);
  fieldHeight(f);
  put(box, grow(f));
  return box;
}
/** A stretched NSTextField draws text at its top; pin it on macOS. */
function fieldHeight(f: Widget): void {
  widgetSetHeight(f, isMobile ? 44 : 22);
}
/** Search pill with a magnifying glass. */
export function searchField(placeholder: string, value: string, onChange: (s: string) => void): Widget {
  const box = hrow(8);
  bg(box, SURFACE3);
  setCornerRadius(box, 12);
  setPadding(box, 0, 12, 0, 12);
  widgetSetHeight(box, 40);
  put(box, symbol("magnifyingglass", 15, MUTED));
  const f = TextField(placeholder, onChange);
  textfieldSetBorderless(f, 1);
  textfieldSetBackgroundColor(f, 0, 0, 0, 0);
  textfieldSetFontSize(f, 16);
  textfieldSetTextColor(f, INK[0], INK[1], INK[2], 1);
  if (value.length > 0) textfieldSetString(f, value);
  fieldHeight(f);
  put(box, grow(f));
  return box;
}
export function textArea(value: string, height: number, onChange: (s: string) => void): Widget {
  const a = TextArea("", onChange);
  widgetSetHeight(a, height);
  bg(a, SURFACE2);
  setCornerRadius(a, 12);
  if (value.length > 0) textareaSetString(a, value);
  return a;
}
/**
 * A labelled form field: title (+ optional trailing widget such as a
 * character counter), the control, then optional help text.
 */
export function field(title: string, trailing: Widget | null, control: Widget, help: string): Widget {
  const v = column(7);
  const head = hrow(8);
  put(head, grow(text(title, 14, 600, BODY, 1)));
  if (trailing) put(head, trailing);
  add(v, head);
  add(v, control);
  if (help.length > 0) add(v, text(help, 13, 400, MUTED, 0));
  return v;
}
/** "54 / 160" counter; colour shows whether `n` is inside [min, max]. */
export function counter(): Widget {
  return text("", 12, 600, MUTED, 1);
}
export function setCounter(w: Widget, n: number, min: number, max: number): void {
  textSetString(w, max > 0 ? `${n} / ${max}` : String(n));
  const ok = n >= min && (max <= 0 || n <= max);
  color(w, n === 0 ? MUTED : ok ? OK_FG : WARN_FG);
}

// ---------- feedback -----------------------------------------------------

/** Inline banner. kind: K_INFO / K_OK / K_WARN / K_DANGER. */
export function banner(kind: number, icon: string, message: string): Widget {
  const k = kindColors(kind);
  const r = HStack(10, []);
  stackSetAlignment(r, 3);
  bg(r, k.fill);
  setCornerRadius(r, 12);
  setPadding(r, 12, 14, 12, 14);
  put(r, symbol(icon, 17, k.fg));
  put(r, grow(text(message, 14, 500, k.fg, 0)));
  return r;
}

/** Big friendly empty state with an optional call to action. */
export function emptyState(icon: string, title: string, message: string, ctaLabel: string, cta: (() => void) | null): Widget {
  const v = centerColumn(10);
  setPadding(v, 44, 24, 36, 24);
  put(v, softTile(icon, BRAND_INK, BRAND_TINT, 64, true));
  put(v, gap(4));
  const t = text(title, 18, 700, INK, 0);
  textSetTextAlignment(t, 2);
  put(v, t);
  const m = text(message, 15, 400, MUTED, 0);
  textSetTextAlignment(m, 2);
  add(v, m);
  if (cta && ctaLabel.length > 0) {
    put(v, gap(6));
    put(v, chipButton(ctaLabel, "", B_PRIMARY, cta));
  }
  return v;
}

/** Spinner + label, centred. */
export function loadingBlock(label: string): Widget {
  const v = centerColumn(12);
  setPadding(v, 48, 0, 48, 0);
  put(v, ProgressView());
  if (label.length > 0) put(v, text(label, 14, 400, MUTED, 1));
  return v;
}

function bar(width: number, height: number): Widget {
  const b = HStack(0, []);
  if (width > 0) widgetSetWidth(b, width);
  widgetSetHeight(b, height);
  bg(b, SURFACE3);
  setCornerRadius(b, height / 2);
  return b;
}
/**
 * Placeholder rows shown while a list loads. Pulses until `alive()` turns
 * false (the screen moved on).
 */
export function skeletonList(rows: number, withThumb: boolean, alive: () => boolean): Widget {
  const list: Widget[] = [];
  for (let i = 0; i < rows; i++) {
    const r = hrow(12);
    setPadding(r, 14, 16, 14, 16);
    if (withThumb) {
      const th = bar(44, 44);
      setCornerRadius(th, 10);
      put(r, th);
    }
    const lines = column(8);
    put(lines, bar(150 + ((i * 37) % 80), 12));
    put(lines, bar(90 + ((i * 53) % 60), 10));
    put(r, grow(lines));
    list.push(r);
  }
  const g = group(list, withThumb ? 72 : 16);
  let on = true;
  const pulse = (): void => {
    if (!alive()) return;
    widgetAnimateOpacity(g, on ? 0.45 : 1, 0.7);
    on = !on;
    setTimeout(pulse, 750);
  };
  setTimeout(pulse, 120);
  return g;
}

// ---------- tiles --------------------------------------------------------

/** A dashboard metric: icon, big number, label. */
export function statTile(icon: string, tint: Rgba, value: string, label: string, run: (() => void) | null): Widget {
  const c = card(14, 10);
  put(c, softTile(icon, tint, tintFill(tint), 32, false));
  const v = column(1);
  const n = text(value, 26, 700, INK, 1);
  textSetLetterSpacing(n, -0.5);
  put(v, n);
  put(v, text(label, 13, 500, MUTED, 1));
  add(c, v);
  if (run) onTap(c, run);
  return c;
}
/** A pale fill of a tile colour for soft icon backgrounds. */
export function tintFill(c: Rgba): Rgba {
  if (dark) return [c[0] * 0.28 + 0.07, c[1] * 0.28 + 0.07, c[2] * 0.28 + 0.08, 1];
  return [c[0] * 0.14 + 0.86, c[1] * 0.14 + 0.86, c[2] * 0.14 + 0.86, 1];
}

/** Hero card with the brand gradient. */
/**
 * Hero card with the brand gradient. Returns the shadowed outer widget and
 * the inner column to fill.
 */
export function heroCard(): { outer: Widget; inner: Widget } {
  const v = column(6);
  widgetSetBackgroundGradient(v, BRAND[0], BRAND[1], BRAND[2], 1, 0.86, 0.33, 0.04, 1, 120);
  setCornerRadius(v, 20);
  setPadding(v, 18, 18, 18, 18);
  return { outer: shadowed(v, 2, true), inner: v };
}
