// =============================================================================
// Standard JSON API response helpers used across `src/pages/api/*`.
// Moved out of `src/lib/helpers.ts` (Enhancement Batch). Re-exported from
// `src/lib/helpers.ts` for backward compatibility.
// =============================================================================

/**
 * Global redirect helper for `src/pages/api/admin/**` endpoints.
 *
 * BUG FIX (Global Redirect Bug Fix): Node's `Response.redirect()` (Undici)
 * requires an ABSOLUTE URL — unlike Astro's own `context.redirect()` /
 * `Astro.redirect()` helpers, which happily accept a relative path. Every
 * admin API route in this codebase used to call the raw, global
 * `Response.redirect('/admin/...', 303)` with a relative path directly,
 * which throws `TypeError: Failed to parse URL from /admin/...` at runtime
 * (`ERR_INVALID_URL`) as soon as it executes.
 *
 * Because that throw happened *inside* the `try` block of every
 * create/update/delete handler (right after a successful write), it was
 * caught by that same handler's own `catch`, which then tried to build a
 * *second* redirect — to the same relative, still-invalid URL, but now with
 * the first error's message stuffed into `?toast=`. That second
 * `Response.redirect()` call threw again, this time uncaught, which is why
 * the browser ends up on an Astro error page showing a `toast=` value that
 * contains an entire nested, URL-encoded `Failed to parse URL from
 * /admin/...` message — i.e. a "successful" action being reported as a
 * failure, with the redirect target never actually reached.
 *
 * `redirectAbsolute` fixes this at the source: it resolves the given path
 * against the incoming `request.url` (so it always ends up with a proper
 * absolute `http://host/admin/...` URL, in dev, in a Vercel/Node preview, or
 * behind a reverse proxy) and only then calls `Response.redirect()`. All
 * `src/pages/api/admin/**` handlers should use this instead of calling
 * `Response.redirect()` directly.
 */
export function redirectAbsolute(
  request: Request,
  path: string,
  status: 301 | 302 | 303 | 307 | 308 = 303
): Response {
  return Response.redirect(new URL(path, request.url), status);
}

export function jsonOk(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Formats a ZodError-like `issues` array into a flat `{ field: message }` map,
 * convenient for re-populating form errors without redirecting.
 */
export function zodIssuesToFieldErrors(
  issues: Array<{ path: (string | number)[]; message: string }>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join('.') || '_root';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
