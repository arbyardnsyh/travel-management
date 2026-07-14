import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

const MISSING_ENV = !SUPABASE_URL || !SUPABASE_ANON_KEY;

if (MISSING_ENV) {
  // Fail loudly in the terminal rather than silently returning null data
  // everywhere, but DON'T throw here — throwing at module scope would crash
  // every single page (including the login page) before it can even render.
  // eslint-disable-next-line no-console
  console.warn(
    '\n[supabase] PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY belum diset.\n' +
      '           1) Salin .env.example menjadi .env\n' +
      '           2) Isi kredensial dari Supabase Dashboard > Project Settings > API\n' +
      '           3) Restart `npm run dev`\n'
  );
}

// Safe placeholder so createClient() never throws at boot when .env is
// missing. Real queries will simply fail (data: null, error: set) instead of
// crashing the whole dev server / page render.
const SAFE_URL = SUPABASE_URL || 'https://placeholder.supabase.co';
const SAFE_ANON_KEY = SUPABASE_ANON_KEY || 'public-anon-key-placeholder';

const AUTH_COOKIE_NAME = 'sb-session';

/**
 * Client-safe Supabase instance (anon key only). Safe to import in .astro
 * frontmatter for public pages — respects RLS policies for anonymous users.
 */
export const supabase: SupabaseClient = createClient(SAFE_URL, SAFE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

/**
 * Creates a request-scoped Supabase client that carries the visitor's auth
 * session (read from cookies) so RLS policies apply as the logged-in user
 * (admin/editor), not as anon. Use this inside pages/middleware that need to
 * know "who is logged in".
 */
export function createServerSupabaseClient(cookies: AstroCookies): SupabaseClient {
  const accessToken = cookies.get(`${AUTH_COOKIE_NAME}-access`)?.value;
  const refreshToken = cookies.get(`${AUTH_COOKIE_NAME}-refresh`)?.value;

  const client = createClient(SAFE_URL, SAFE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
  });

  if (accessToken && refreshToken) {
    // Attach session so client.auth.getUser() / getSession() work too.
    client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).catch(() => {
      /* invalid/expired session — middleware will redirect to /login */
    });
  }

  return client;
}

/**
 * Privileged Supabase client using the SERVICE ROLE key. Bypasses RLS.
 * NEVER import this in code that runs in the browser. Only use inside
 * `src/pages/api/**` server endpoints for trusted server-side operations
 * (e.g. admin user management, storage cleanup jobs).
 */
export function createAdminSupabaseClient(): SupabaseClient {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY belum diset di .env — dibutuhkan untuk operasi admin.'
    );
  }
  return createClient(SAFE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export const STORAGE_BUCKET = import.meta.env.PUBLIC_SUPABASE_STORAGE_BUCKET || 'media';

export { AUTH_COOKIE_NAME };
