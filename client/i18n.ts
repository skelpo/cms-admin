// UI language: English (the keys) and German (./locales/de.ts).
//
// Every user-facing string goes through `tr(<English text>, { param })`. The
// English text is the key, so the source reads naturally and a missing German
// entry falls back to English. `{name}` placeholders are filled from params.
// `scripts/i18n-check.py` (make i18n) fails on keys missing from or unused in
// the German table.
//
// The language is fixed at launch from the device (`getLocale()`). On iOS that
// only reports German when the bundle declares a German localization
// (CFBundleLocalizations + de.lproj, added by scripts/ios-localize.sh); iOS
// Settings then also offers a per-app language switch. The `SKELPO_LANG`
// user default (en|de) overrides it, e.g. for App Store screenshots.
//
// This is a plain runtime lookup rather than Perry's compile-time `perry/i18n`
// rewrite, which only sees literals passed straight to perry/ui widgets (this
// app wraps them in ui.ts helpers).
import { getLocale, preferencesGet } from "perry/system";
import { DE } from "./locales/de.js";

function detect(): string {
  const forced = preferencesGet("SKELPO_LANG");
  if (forced === "de" || forced === "en") return forced;
  const l = getLocale();
  return typeof l === "string" && l.toLowerCase().indexOf("de") === 0 ? "de" : "en";
}

/** "en" or "de". */
export const LANG: string = detect();
export const isGerman = LANG === "de";

export function tr(key: string, params?: Record<string, string | number>): string {
  let s = key;
  if (isGerman) {
    const d = DE[key];
    if (typeof d === "string" && d.length > 0) s = d;
  }
  if (params) {
    for (const k in params) s = s.split(`{${k}}`).join(String(params[k]));
  }
  return s;
}

/** `one` or `other` (both keys containing `{n}`), filled with n. */
export function plural(n: number, one: string, other: string): string {
  return tr(n === 1 ? one : other, { n });
}

/** A CMS label used mid-sentence: lower-cased in English, but German nouns keep their capital. */
export function noun(label: string): string {
  return isGerman ? label : label.toLowerCase();
}

/** Decimal number with the language's separator ("1.5" / "1,5"). */
export function decimal(n: number, digits: number): string {
  const s = n.toFixed(digits);
  return isGerman ? s.replace(".", ",") : s;
}
