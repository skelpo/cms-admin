// The CMS returns errors as `{ error: { code, message, details? } }`. This
// mirrors that envelope and gives the client a single typed error to throw.

export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export class ApiError extends Error {
  /** HTTP status, or 0 when the request never produced a CMS response. */
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Parse a non-2xx response body into an ApiError. Falls back gracefully when
 *  the body isn't the expected JSON envelope (e.g. a proxy's HTML error page). */
export function toApiError(status: number, rawBody: string): ApiError {
  let code = `http_${status}`;
  let message = "";
  let details: Record<string, unknown> | undefined;
  try {
    const parsed = JSON.parse(rawBody) as Partial<ApiErrorBody>;
    if (parsed && parsed.error) {
      code = parsed.error.code ?? code;
      message = parsed.error.message ?? "";
      details = parsed.error.details;
    }
  } catch {
    // not JSON — never show raw HTML to the user
  }
  if (message.length === 0) {
    if (status === 404) message = "Not found on this server. Check the server address.";
    else if (status === 401) message = "You're signed out. Sign in again.";
    else if (status === 403) message = "Your role isn't allowed to do this.";
    else if (status >= 500) message = `The server had a problem (HTTP ${status}).`;
    else message = `Request failed (HTTP ${status}).`;
  }
  return new ApiError(status, code, message, details);
}

/**
 * User-facing text for any thrown value. Validation failures carry their
 * reasons in `details.errors[] = { field, message }` behind a generic
 * top-level message, so those are spelled out.
 */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const d = e.details;
    if (d) {
      const errs = d["errors"];
      if (Array.isArray(errs) && errs.length > 0) {
        const lines: string[] = [];
        for (let i = 0; i < errs.length; i++) {
          const one = errs[i] as { field?: string; message?: string; constraint?: string } | null;
          if (!one) continue;
          const what = one.message ?? one.constraint ?? "invalid";
          lines.push(one.field ? `${one.field}: ${what}` : what);
        }
        if (lines.length > 0) return `${e.message}\n${lines.join("\n")}`;
      }
      const retry = d["retryAfterS"];
      if (typeof retry === "number") {
        return `${e.message} Try again in ${Math.ceil(retry / 60)} min.`;
      }
    }
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}
