import { defineMiddleware } from 'astro:middleware';
import { getCurrentUser } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase';

const PROTECTED_PAGE_PREFIX = '/admin';
const PROTECTED_API_PREFIX = '/api/admin';
const LOGIN_PATH = '/login';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Attach a request-scoped Supabase client for every request so pages/API
  // routes can read it from context.locals without re-creating it.
  context.locals.supabase = createServerSupabaseClient(context.cookies);

  const isProtectedPage = pathname.startsWith(PROTECTED_PAGE_PREFIX);
  // BUG FIX: `/api/admin/**` (e.g. `/api/admin/upload`, `/api/admin/gallery`)
  // does NOT start with `/admin` — it starts with `/api`. The previous check
  // only matched page routes, so every admin API request fell into the
  // "not protected" branch below and got `locals.user = null` without ever
  // reading the session cookie. Every `requireRole(locals.user, [...])` call
  // in `src/pages/api/admin/**` then always failed with 403, even for a
  // logged-in admin. Session lookup now also runs for `/api/admin/**` so
  // those routes see the real user; page-level redirect behavior for
  // `/admin/**` is unchanged.
  const isProtectedApi = pathname.startsWith(PROTECTED_API_PREFIX);
  const isProtected = isProtectedPage || isProtectedApi;
  const isLoginPage = pathname === LOGIN_PATH;

  if (!isProtected && !isLoginPage) {
    context.locals.user = null;
    return next();
  }

  const user = await getCurrentUser(context.cookies);
  context.locals.user = user;

  // Redirects only make sense for page navigation; admin API routes reply
  // with their own JSON 403 (via `requireRole()` + `jsonError()`) instead of
  // being redirected, so a fetch()/XHR call gets a proper JSON error rather
  // than an HTML redirect response.
  if (isProtectedPage && !user) {
    const redirectTo = encodeURIComponent(pathname);
    return context.redirect(`${LOGIN_PATH}?redirect=${redirectTo}`);
  }

  if (isProtectedPage && user && !['admin', 'editor'].includes(user.role)) {
    return context.redirect('/login?error=forbidden');
  }

  // Already logged in and visiting /login → send to dashboard.
  if (isLoginPage && user) {
    return context.redirect('/admin/dashboard');
  }

  return next();
});
