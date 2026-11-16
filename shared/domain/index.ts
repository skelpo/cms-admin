// Domain types mirroring the Skelpo CMS `/api/v1` REST contract.
//
// Every shape here was checked against the route handlers in
// ../../skelpo-cms/src/routes/api (not docs/api-spec.md, which is stale in
// places). Where the backend leaks a raw driver date object instead of an ISO
// string, the field is typed `unknown` and must not be rendered directly.

// ---------- shared scalars ----------------------------------------------

/** ISO-8601 timestamp string, always UTC. */
export type Iso = string;

/** Localized string: locale code → value (e.g. `{ en: "Home", de: "Start" }`). */
export type Localized = Record<string, string>;

// ---------- auth / users / roles ----------------------------------------

export type UserStatus = "active" | "suspended" | "invited";

export interface PublicUser {
  id: number;
  email: string;
  displayName: string;
  role: { id: number; slug: string; label: string };
  locale: string;
  totpEnabled: boolean;
  status: UserStatus;
  lastLoginAt: Iso | null;
  createdAt: Iso;
}

/** A role's capability grants. `"*"` is the wildcard in both lists. */
export interface RoleCapabilities {
  /** Global verbs, e.g. `["manageUsers", "manageSettings"]` or `["*"]`. */
  global: string[];
  /** Per-content-type verbs, e.g. `{ post: ["create", "publish"] }`; key `"*"` = all types. */
  types: Record<string, string[]>;
}

export interface Role {
  id: number;
  slug: string;
  label: string;
  capabilities: RoleCapabilities;
  isBuiltin: number; // 0 | 1
}

/** Row returned by GET /users (flattened, with role label/slug inlined). */
export interface UserListItem {
  id: number;
  email: string;
  displayName: string;
  roleId: number;
  roleSlug?: string;
  roleLabel?: string;
  locale: string;
  status: UserStatus;
  lastLoginAt: Iso | null;
  createdAt: Iso;
}

export interface LoginResult {
  user: PublicUser;
  /** 64-hex session token. Replayed as the `skelpoSession` cookie. */
  token: string;
  expiresAt: Iso;
}

export interface MeResult {
  user: PublicUser;
  role: Role;
  capabilities: RoleCapabilities;
}

// ---------- content & content types -------------------------------------

export type ContentStatus = "draft" | "review" | "published" | "archived";

export interface ContentItem {
  id: number;
  type: string;
  slug: string;
  locale: string;
  translationGroupId: number;
  status: ContentStatus;
  title: string;
  fields: Record<string, unknown>;
  seo: Record<string, unknown>;
  ai: Record<string, unknown>;
  authorId: number | null;
  publishedAt: Iso | null;
  scheduledAt: Iso | null;
  revision: number;
  schemaRevision: number;
  createdAt: Iso;
  updatedAt: Iso;
  url: string | null;
}

export interface ContentPage {
  data: ContentItem[];
  pagination: { nextCursor: string | null; hasMore: boolean };
}

/**
 * One field in a content type's schema. Types seen in production schemas:
 * text, textarea, richtext, number, boolean, date, datetime, select,
 * multiselect, url, email, image, gallery, relation, repeater, json.
 */
export interface FieldDef {
  name: string;
  type: string;
  label?: string;
  translatable?: boolean;
  required?: boolean;
  validation?: { options?: string[]; min?: number; max?: number; maxLength?: number };
  admin?: { help?: string };
  relation?: { toType: string; many: boolean; max?: number };
  repeater?: { fields: FieldDef[]; min?: number; max?: number };
}

export interface FieldsSchema {
  fields: FieldDef[];
}

export interface ContentType {
  id: number;
  slug: string;
  labelSingular: string;
  labelPlural: string;
  isBuiltin: number;
  isRoutable: number;
  urlPattern: string | null;
  fieldsSchema: FieldsSchema;
  currentRevision: number;
  icon: string | null;
  sortOrder: number;
}

// ---------- menus --------------------------------------------------------

/** Row from GET /menus. */
export interface MenuSummary {
  id: number;
  slug: string;
  label: string;
  isBuiltin: number;
}

/** Item from GET /menus/:slug — `label` is already resolved for the locale. */
export interface MenuItem {
  id: number;
  label: string;
  url: string | null;
  contentId: number | null;
  target: string;
  sortOrder: number;
  children: MenuItem[];
}

export interface MenuDetail {
  slug: string;
  label: string;
  items: MenuItem[];
}

// ---------- forms --------------------------------------------------------

export interface FormSubmission {
  id: number;
  data: Record<string, unknown>;
  ip: string | null;
  isSpam: number; // 0 | 1
  createdAt: Iso;
}

// ---------- redirects ----------------------------------------------------

export interface Redirect {
  id: number;
  source: string;
  destination: string;
  statusCode: number; // 301 | 302 | 307 | 308
}

// ---------- webhooks -----------------------------------------------------

export interface Webhook {
  id: number;
  url: string;
  events: string[];
  active: number; // 0 | 1
  description: string | null;
}

export interface WebhookDelivery {
  id: number;
  event: string;
  responseStatus: number | null;
  latencyMs: number | null;
  succeeded: number; // 0 | 1
  error: string | null;
  /** Raw driver date object on current backends — do not render directly. */
  createdAt: unknown;
}

// ---------- jobs ---------------------------------------------------------

export interface JobSummary {
  id: number;
  kind?: string;
  queue?: string;
  status: string; // pending | running | done | failed | dead
  runAt: Iso;
  attempts: number;
  lastError: string | null;
  createdAt: Iso;
}

/** Status → count. A status with zero rows is absent from the map. */
export type JobStats = Record<string, number>;

// ---------- media --------------------------------------------------------

export interface MediaItem {
  id: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  altText: Localized;
  focalPoint: { x: number; y: number } | null;
  createdAt: Iso;
  /** Relative path (`/api/v1/media/<id>/raw`); public, may 302 to storage. */
  urlRaw: string;
}
