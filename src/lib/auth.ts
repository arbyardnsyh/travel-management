import type { AstroCookies } from 'astro';
import { supabase, createServerSupabaseClient, AUTH_COOKIE_NAME } from './supabase';
import type { UserProfile } from './database.types';

const COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: import.meta.env.PROD,
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

export interface AuthResult {
  success: boolean;
  error?: string;
  user?: UserProfile;
}

/**
 * Signs a user in with email/password, stores the Supabase session in
 * secure httpOnly cookies, and verifies the profile has an admin/editor
 * role before allowing dashboard access.
 */
export async function loginWithPassword(
  email: string,
  password: string,
  cookies: AstroCookies
): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session || !data.user) {
    return { success: false, error: error?.message ?? 'Email atau password salah.' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return { success: false, error: 'Profil pengguna tidak ditemukan.' };
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    return { success: false, error: 'Akun Anda dinonaktifkan. Hubungi administrator.' };
  }

  if (profile.role !== 'admin' && profile.role !== 'editor') {
    await supabase.auth.signOut();
    return { success: false, error: 'Anda tidak memiliki akses ke dashboard.' };
  }

  cookies.set(`${AUTH_COOKIE_NAME}-access`, data.session.access_token, COOKIE_OPTIONS);
  cookies.set(`${AUTH_COOKIE_NAME}-refresh`, data.session.refresh_token, COOKIE_OPTIONS);

  return { success: true, user: profile as UserProfile };
}

/** Clears the auth cookies and revokes the Supabase session. */
export async function logout(cookies: AstroCookies): Promise<void> {
  const client = createServerSupabaseClient(cookies);
  await client.auth.signOut();
  cookies.delete(`${AUTH_COOKIE_NAME}-access`, { path: '/' });
  cookies.delete(`${AUTH_COOKIE_NAME}-refresh`, { path: '/' });
}

/**
 * Reads the current session from cookies and returns the matching profile,
 * or null if not authenticated / session invalid / profile missing.
 */
export async function getCurrentUser(cookies: AstroCookies): Promise<UserProfile | null> {
  const accessToken = cookies.get(`${AUTH_COOKIE_NAME}-access`)?.value;
  if (!accessToken) return null;

  const client = createServerSupabaseClient(cookies);
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) return null;

  const { data: profile, error: profileError } = await client
    .from('users')
    .select('*')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !profile) return null;
  return profile as UserProfile;
}

/** Simple guard used by protected admin API routes. */
export function requireRole(user: UserProfile | null, roles: Array<'admin' | 'editor'>): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}
