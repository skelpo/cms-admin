// API client for the Skelpo CMS `/api/v1` REST contract.
//
// Auth: POST /auth/login returns a session token that the CMS normally tracks
// via the `skelpoSession` cookie. A native client has no cookie jar, so the
// token is replayed as `Cookie: skelpoSession=<token>` on every request. The
// CMS has no CSRF/Origin check on /api/v1, so this works for mutations too.
// (Bearer auth is for `skp_v1_…` API tokens and rejects session tokens.)
//
// Paths: the CMS router is strict — `/content` works, `/content/` is a 404.
// Never add a trailing slash to a collection path.
//
// Transport: the Web Fetch API. Perry's native fetch carries string, binary
// and multipart (`FormData`) bodies.
import * as fs from "node:fs";
import { ApiError, toApiError } from "../shared/api/errors.js";
import type {
  ContentItem,
  ContentPage,
  ContentType,
  FormSubmission,
  JobStats,
  JobSummary,
  LoginResult,
  MediaItem,
  MeResult,
  MenuDetail,
  MenuSummary,
  Redirect,
  Role,
  UserListItem,
  Webhook,
  WebhookDelivery,
} from "../shared/domain/index.js";
import { tr } from "./i18n.js";

// ---------- connection state --------------------------------------------

let baseUrl = "";
let sessionToken: string | null = null;

/**
 * Normalise what the user typed into a base URL: trims, adds a scheme when
 * none is given (`https://`, or `http://` for loopback/LAN development
 * hosts), and strips a trailing slash plus a pasted `/admin` or `/api/v1`
 * suffix.
 */
export function normalizeBaseUrl(input: string): string {
  let url = input.trim();
  if (url.length === 0) return "";
  if (!/^https?:\/\//i.test(url)) {
    const local = /^(localhost|127\.|10\.|192\.168\.|[^/:]+\.local)([:/]|$)/i.test(url);
    url = `${local ? "http" : "https"}://${url}`;
  }
  url = url.replace(/\/+$/, "");
  url = url.replace(/\/(admin|api\/v1|api)$/i, "");
  return url.replace(/\/+$/, "");
}

export function setBaseUrl(url: string): void {
  baseUrl = normalizeBaseUrl(url);
}
export function getBaseUrl(): string {
  return baseUrl;
}
export function setSessionToken(token: string | null): void {
  sessionToken = token;
}
export function getSessionToken(): string | null {
  return sessionToken;
}

// ---------- low-level request -------------------------------------------

type Query = Record<string, string | number | undefined>;

interface ReqOpts {
  query?: Query;
  body?: unknown;
}

function buildUrl(path: string, query?: Query): string {
  let url = `${baseUrl}/api/v1${path}`;
  if (query) {
    const parts: string[] = [];
    for (const key in query) {
      const v = query[key];
      if (v === undefined) continue;
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
    if (parts.length > 0) url += `?${parts.join("&")}`;
  }
  return url;
}

async function send(url: string, init: Record<string, unknown>): Promise<{ status: number; text: string }> {
  let r: Response;
  try {
    r = await fetch(url, init as never);
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    throw new ApiError(0, "network", tr("Can't reach the server ({why}).", { why }));
  }
  const text = await r.text();
  if (!r.ok) throw toApiError(r.status, text);
  return { status: r.status, text };
}

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    // An HTML page here almost always means the URL points at a website
    // whose proxy doesn't forward /api/v1 to the CMS.
    throw new ApiError(0, "notCms", tr("The server answered, but not with CMS data. Check the server address."));
  }
}

async function request<T>(method: string, path: string, opts?: ReqOpts): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (sessionToken) headers["Cookie"] = `skelpoSession=${sessionToken}`;
  const init: Record<string, unknown> = { method, headers };
  if (opts && opts.body !== undefined) {
    headers["content-type"] = "application/json";
    init["body"] = JSON.stringify(opts.body);
  }
  const res = await send(buildUrl(path, opts ? opts.query : undefined), init);
  if (res.status === 204 || res.text.length === 0) return undefined as unknown as T;
  return parseJson<T>(res.text);
}

/** Most CMS responses wrap the payload in `{ data: ... }`. */
async function reqData<T>(method: string, path: string, opts?: ReqOpts): Promise<T> {
  const parsed = await request<{ data: T }>(method, path, opts);
  if (!parsed || typeof parsed !== "object" || !("data" in parsed)) {
    throw new ApiError(0, "notCms", tr("Unexpected response from the server."));
  }
  return parsed.data;
}

// ---------- server check -------------------------------------------------

/**
 * Confirm `baseUrl` is a reachable Skelpo CMS whose API is exposed.
 * `GET /types` is public and returns `{ data: [...] }`.
 */
export async function probeServer(): Promise<void> {
  const types = await reqData<unknown>("GET", "/types");
  if (!Array.isArray(types)) {
    throw new ApiError(0, "notCms", tr("This server doesn't look like a Skelpo CMS."));
  }
}

// ---------- auth ---------------------------------------------------------

export async function login(email: string, password: string, totpCode?: string): Promise<LoginResult> {
  const body: { email: string; password: string; totpCode?: string } = { email, password };
  if (totpCode) body.totpCode = totpCode;
  // Never send a stale cookie with a login attempt.
  const previous = sessionToken;
  sessionToken = null;
  try {
    const data = await reqData<LoginResult>("POST", "/auth/login", { body });
    sessionToken = data.token;
    return data;
  } catch (e) {
    sessionToken = previous;
    throw e;
  }
}

/** True when a failed login is asking for a TOTP code. */
export function isTotpRequired(e: unknown): boolean {
  if (!(e instanceof ApiError)) return false;
  const d = e.details;
  return !!d && d["totpRequired"] === true;
}

export async function me(): Promise<MeResult> {
  return reqData<MeResult>("GET", "/auth/me");
}

/**
 * Rotate the session. The CMS creates a new session and leaves the old one
 * valid, so the old token is logged out explicitly afterwards.
 */
export async function refreshSession(): Promise<LoginResult> {
  const old = sessionToken;
  const data = await reqData<LoginResult>("POST", "/auth/refresh");
  if (old && old !== data.token) {
    sessionToken = old;
    try {
      await request<void>("POST", "/auth/logout");
    } catch {
      // best-effort
    }
  }
  sessionToken = data.token;
  return data;
}

export async function logout(): Promise<void> {
  try {
    await request<void>("POST", "/auth/logout");
  } catch {
    // best-effort; local sign-out happens regardless
  }
  sessionToken = null;
}

export async function changeOwnProfile(userId: number, patch: { displayName?: string; password?: string }): Promise<void> {
  await request<void>("PATCH", `/users/${userId}`, { body: patch });
}

// ---------- content ------------------------------------------------------

export interface ListContentParams {
  type: string;
  /** One status or a comma list. Omitted = published only (even for admins). */
  status?: string;
  locale?: string | undefined;
  limit?: number;
  cursor?: string | undefined;
  slug?: string;
}

export async function listContent(params: ListContentParams): Promise<ContentPage> {
  const page = await request<ContentPage>("GET", "/content", {
    query: {
      type: params.type,
      status: params.status,
      locale: params.locale,
      limit: params.limit,
      cursor: params.cursor,
      slug: params.slug,
    },
  });
  if (!page || !Array.isArray(page.data)) {
    throw new ApiError(0, "notCms", tr("Unexpected response from the server."));
  }
  return page;
}

export async function getContent(id: number): Promise<ContentItem> {
  return reqData<ContentItem>("GET", `/content/by-id/${id}`);
}

export interface CreateContentInput {
  type: string;
  slug: string;
  locale: string;
  title: string;
  fields?: Record<string, unknown>;
  /** Id of a sibling item whose translation group this row joins. */
  translationOf?: number;
}
export async function createContent(input: CreateContentInput): Promise<ContentItem> {
  return reqData<ContentItem>("POST", "/content", { body: input });
}

export interface UpdateContentInput {
  slug?: string;
  title?: string;
  fields?: Record<string, unknown>;
  seo?: Record<string, unknown>;
}
export async function updateContent(id: number, patch: UpdateContentInput): Promise<ContentItem> {
  return reqData<ContentItem>("PATCH", `/content/${id}`, { body: patch });
}

/** Soft delete (archive) by default; `hard` removes the row. */
export async function deleteContent(id: number, hard: boolean): Promise<void> {
  await request<void>("DELETE", `/content/${id}`, { query: { hard: hard ? "true" : undefined } });
}
export async function publishContent(id: number): Promise<ContentItem> {
  return reqData<ContentItem>("POST", `/content/${id}/publish`);
}
export async function unpublishContent(id: number): Promise<ContentItem | null> {
  return reqData<ContentItem | null>("POST", `/content/${id}/unpublish`);
}

// ---------- content types ------------------------------------------------

export async function listTypes(): Promise<ContentType[]> {
  return reqData<ContentType[]>("GET", "/types");
}

// ---------- menus --------------------------------------------------------

export async function listMenus(): Promise<MenuSummary[]> {
  return reqData<MenuSummary[]>("GET", "/menus");
}
export async function getMenu(slug: string, locale?: string): Promise<MenuDetail> {
  return reqData<MenuDetail>("GET", `/menus/${encodeURIComponent(slug)}`, { query: { locale } });
}
export async function createMenuItem(
  menuSlug: string,
  input: { label: Record<string, string>; url: string; sortOrder: number },
): Promise<{ id: number }> {
  return reqData<{ id: number }>("POST", `/menus/${encodeURIComponent(menuSlug)}/items`, { body: input });
}
export async function deleteMenuItem(menuSlug: string, id: number): Promise<void> {
  await request<void>("DELETE", `/menus/${encodeURIComponent(menuSlug)}/items/${id}`);
}

// ---------- forms --------------------------------------------------------

/** Capped at the newest 200 by the CMS. */
export async function listSubmissions(slug: string, includeSpam: boolean): Promise<FormSubmission[]> {
  return reqData<FormSubmission[]>("GET", `/forms/${encodeURIComponent(slug)}/submissions`, {
    query: { spam: includeSpam ? "true" : undefined },
  });
}
export async function markSubmissionSpam(id: number): Promise<void> {
  await request<void>("POST", `/forms/submissions/${id}/mark-spam`);
}
export async function deleteSubmission(id: number): Promise<void> {
  await request<void>("DELETE", `/forms/submissions/${id}`);
}

// ---------- redirects ----------------------------------------------------

export async function listRedirects(): Promise<Redirect[]> {
  return reqData<Redirect[]>("GET", "/redirects");
}
export async function createRedirect(source: string, destination: string, statusCode: number): Promise<Redirect> {
  return reqData<Redirect>("POST", "/redirects", { body: { source, destination, statusCode } });
}
export async function deleteRedirect(id: number): Promise<void> {
  await request<void>("DELETE", `/redirects/${id}`);
}

// ---------- settings -----------------------------------------------------

export async function getSettings(): Promise<Record<string, unknown>> {
  return reqData<Record<string, unknown>>("GET", "/settings");
}
export async function putSetting(key: string, value: unknown): Promise<void> {
  await request<unknown>("PUT", `/settings/${encodeURIComponent(key)}`, { body: { value } });
}

// ---------- webhooks -----------------------------------------------------

export async function listWebhooks(): Promise<Webhook[]> {
  return reqData<Webhook[]>("GET", "/webhooks");
}
export async function setWebhookActive(id: number, active: boolean): Promise<void> {
  await request<void>("PATCH", `/webhooks/${id}`, { body: { active } });
}
export async function listDeliveries(id: number): Promise<WebhookDelivery[]> {
  return reqData<WebhookDelivery[]>("GET", `/webhooks/${id}/deliveries`);
}

// ---------- jobs ---------------------------------------------------------

export async function listJobs(status: string | undefined, limit: number): Promise<JobSummary[]> {
  return reqData<JobSummary[]>("GET", "/jobs", { query: { status, limit } });
}
export async function jobStats(): Promise<JobStats> {
  return reqData<JobStats>("GET", "/jobs/stats");
}
/** Only `failed` and `dead` jobs can be retried. */
export async function retryJob(id: number): Promise<void> {
  await request<unknown>("POST", `/jobs/${id}/retry`);
}

// ---------- users & roles ------------------------------------------------

export async function listUsers(): Promise<UserListItem[]> {
  return reqData<UserListItem[]>("GET", "/users");
}
/** No password = the CMS creates an invited user and emails them. */
export async function inviteUser(email: string, displayName: string, roleId: number): Promise<{ id: number; email: string; status: string }> {
  return reqData("POST", "/users", { body: { email, displayName, roleId } });
}
export async function suspendUser(id: number): Promise<void> {
  await request<void>("POST", `/users/${id}/suspend`);
}
export async function unsuspendUser(id: number): Promise<void> {
  await request<void>("POST", `/users/${id}/unsuspend`);
}
export async function listRoles(): Promise<Role[]> {
  return reqData<Role[]>("GET", "/roles");
}

// ---------- media --------------------------------------------------------

/** Newest first; the CMS exposes no paging, so `limit` (max 200) is the reach. */
export async function listMedia(limit: number): Promise<MediaItem[]> {
  return reqData<MediaItem[]>("GET", "/media", { query: { limit } });
}
export async function updateMediaAlt(id: number, altText: Record<string, string>): Promise<void> {
  await request<void>("PATCH", `/media/${id}`, { body: { altText } });
}
export async function deleteMedia(id: number): Promise<void> {
  await request<void>("DELETE", `/media/${id}`);
}
/** Absolute URL to a media item's bytes (public; no cookie needed). */
export function mediaRawUrl(id: number): string {
  return `${baseUrl}/api/v1/media/${id}/raw`;
}

function mimeForFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "heic") return "image/heic";
  if (ext === "heif") return "image/heif";
  if (ext === "avif") return "image/avif";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "pdf") return "application/pdf";
  if (ext === "mp4") return "video/mp4";
  if (ext === "mov") return "video/quicktime";
  return "application/octet-stream";
}

/** CMS upload ceiling (`POST /media` answers 413 above this). */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Upload a local file as multipart/form-data. `altText` is required by the
 * CMS for images and is sent as a locale-keyed JSON string.
 */
export async function uploadMedia(path: string, filename: string, altText: Record<string, string>): Promise<MediaItem> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(fs.readFileSync(path));
  } catch {
    throw new ApiError(0, "fileRead", tr("Couldn't read the selected file."));
  }
  if (bytes.length === 0) throw new ApiError(0, "fileRead", tr("The selected file is empty."));
  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw new ApiError(413, "contentTooLarge", tr("This file is larger than the 25 MB upload limit."));
  }
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mimeForFilename(filename) }), filename);
  form.append("altText", JSON.stringify(altText));
  const headers: Record<string, string> = { accept: "application/json" };
  if (sessionToken) headers["Cookie"] = `skelpoSession=${sessionToken}`;
  // No content-type header: fetch sets the multipart boundary itself.
  const res = await send(buildUrl("/media"), { method: "POST", headers, body: form });
  return parseJson<{ data: MediaItem }>(res.text).data;
}
