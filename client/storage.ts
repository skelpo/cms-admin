// Persistence for signed-in sites, via the system keychain (macOS login
// keychain, iOS app keychain, Android Keystore, Windows credential store).
//
// The app can stay signed in to several CMS installs (e.g. one per client
// website). Everything lives in one JSON blob so adding a site is a single
// keychain write. Where the keychain is unavailable the calls degrade to
// no-ops and the session lives in memory only.
import { keychainSave, keychainGet, keychainDelete } from "perry/system";

const SITES_KEY = "com.skelpo.cmsadmin.sites";
const ACTIVE_KEY = "com.skelpo.cmsadmin.activeSite";
const LAST_URL_KEY = "com.skelpo.cmsadmin.lastUrl";

export interface SavedSite {
  baseUrl: string;
  email: string;
  token: string;
  /** ISO timestamp the CMS gave for the session's expiry. */
  expiresAt: string;
}

function safeGet(key: string): string {
  try {
    const v = keychainGet(key);
    return typeof v === "string" ? v : "";
  } catch {
    return "";
  }
}

function safeSet(key: string, value: string): void {
  try {
    keychainSave(key, value);
  } catch {
    // ignore — the session continues in memory
  }
}

export function loadSites(): SavedSite[] {
  const raw = safeGet(SITES_KEY);
  if (raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: SavedSite[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const s = parsed[i] as Partial<SavedSite> | null;
      if (!s || typeof s.baseUrl !== "string" || typeof s.token !== "string") continue;
      out.push({
        baseUrl: s.baseUrl,
        email: typeof s.email === "string" ? s.email : "",
        token: s.token,
        expiresAt: typeof s.expiresAt === "string" ? s.expiresAt : "",
      });
    }
    return out;
  } catch {
    return [];
  }
}

function writeSites(sites: SavedSite[]): void {
  if (sites.length === 0) {
    try {
      keychainDelete(SITES_KEY);
    } catch {
      // ignore
    }
    return;
  }
  safeSet(SITES_KEY, JSON.stringify(sites));
}

/** Insert or replace the entry for `site.baseUrl` and make it the active one. */
export function saveSite(site: SavedSite): void {
  const sites = loadSites();
  const next: SavedSite[] = [];
  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    if (s && s.baseUrl !== site.baseUrl) next.push(s);
  }
  next.push(site);
  writeSites(next);
  safeSet(ACTIVE_KEY, site.baseUrl);
  safeSet(LAST_URL_KEY, site.baseUrl);
}

export function removeSite(baseUrl: string): void {
  const sites = loadSites();
  const next: SavedSite[] = [];
  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    if (s && s.baseUrl !== baseUrl) next.push(s);
  }
  writeSites(next);
  if (safeGet(ACTIVE_KEY) === baseUrl) {
    try {
      keychainDelete(ACTIVE_KEY);
    } catch {
      // ignore
    }
  }
}

export function setActiveSite(baseUrl: string): void {
  safeSet(ACTIVE_KEY, baseUrl);
}

/** The site to restore on launch: the last active one, else the newest. */
export function loadActiveSite(): SavedSite | null {
  const sites = loadSites();
  if (sites.length === 0) return null;
  const active = safeGet(ACTIVE_KEY);
  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    if (s && s.baseUrl === active) return s;
  }
  return sites[sites.length - 1] ?? null;
}

/** The last server address used, kept after sign-out to pre-fill sign-in. */
export function loadLastUrl(): string {
  return safeGet(LAST_URL_KEY);
}
