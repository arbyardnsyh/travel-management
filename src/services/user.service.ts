// =============================================================================
// User service — centralizes all `public.users` (+ Supabase Auth Admin API)
// access (Enhancement Batch). Per ARCHITECTURE.md §7/§9: creating/updating a
// user's auth identity requires the SERVICE ROLE client
// (`createAdminSupabaseClient()`) because it calls `auth.admin.createUser`,
// and is restricted to role `admin` (checked by `requireRole` at the
// page/API layer — this service does not itself re-check roles).
//
// No soft delete here (not requested for this table) — staff accounts are
// disabled via `is_active = false` instead of being deleted, which is both
// simpler and avoids ever losing the `created_by` audit trail on content
// tables that reference `users.id`.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Paginated, UserProfile, UserRole } from '@/lib/database.types';
import { createAdminSupabaseClient } from '@/lib/supabase';
import { logActivity } from '@/lib/activity-log';
import { generateTempPassword } from '@/utils/password';
import { USER_ROLES } from '@/lib/constants';
import { resolvePageParams, toPaginated, throwIfError, type BaseListParams } from './_shared';

const TABLE = 'users';

export interface ListUsersParams extends BaseListParams {
  role?: UserRole;
  activeOnly?: boolean;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserInput {
  name?: string;
  role?: UserRole;
  is_active?: boolean;
  avatar_url?: string | null;
}

export async function listUsers(supabase: SupabaseClient, params: ListUsersParams = {}): Promise<Paginated<UserProfile>> {
  const { page, perPage, from, to } = resolvePageParams(params);

  let query = supabase.from(TABLE).select('*', { count: 'exact' });
  if (params.role) query = query.eq('role', params.role);
  if (params.activeOnly) query = query.eq('is_active', true);
  if (params.q) query = query.or(`name.ilike.%${params.q}%,email.ilike.%${params.q}%`);

  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to);
  throwIfError(error);
  return toPaginated(data as UserProfile[] | null, count, page, perPage);
}

export async function getUserById(supabase: SupabaseClient, id: string): Promise<UserProfile | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  throwIfError(error);
  return (data as UserProfile | null) ?? null;
}

/** Total count of staff accounts — powers the Dashboard "Total Users" stat card (Batch 3A-10). */
export async function countUsers(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase.from(TABLE).select('id', { count: 'exact', head: true });
  throwIfError(error);
  return count ?? 0;
}

/** Staff account counts per `role` — powers the Dashboard's "User Role" chart (Batch 3A-10). */
export async function getUserRoleBreakdown(supabase: SupabaseClient): Promise<Record<UserRole, number>> {
  const { data, error } = await supabase.from(TABLE).select('role');
  throwIfError(error);
  const counts = Object.fromEntries(USER_ROLES.map((r) => [r, 0])) as Record<UserRole, number>;
  for (const row of (data ?? []) as Array<{ role: UserRole }>) {
    counts[row.role] = (counts[row.role] ?? 0) + 1;
  }
  return counts;
}

/**
 * Creates a new staff account: registers it in Supabase Auth (service role,
 * bypasses email confirmation since this is an admin-provisioned account),
 * which in turn fires `handle_new_auth_user()` (0001_init_schema.sql) to
 * create the matching `public.users` row automatically.
 */
export async function createUser(input: CreateUserInput, actor: UserProfile | null): Promise<UserProfile> {
  const adminClient = createAdminSupabaseClient();

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name, role: input.role },
  });
  if (authError || !authData.user) {
    throw new Error(authError?.message ?? 'Gagal membuat akun pengguna.');
  }

  // The trigger creates the profile row with role from user_metadata already,
  // but confirm/sync it explicitly in case metadata handling ever changes.
  const { data: profile, error: profileError } = await adminClient
    .from(TABLE)
    .update({ name: input.name, role: input.role })
    .eq('id', authData.user.id)
    .select('*')
    .single();
  throwIfError(profileError);

  await logActivity(adminClient, {
    actor,
    action: 'create',
    entity: 'users',
    entityId: authData.user.id,
    description: `Menambahkan pengguna "${input.name}" (${input.role})`,
  });
  return profile as UserProfile;
}

export async function updateUser(
  supabase: SupabaseClient,
  id: string,
  input: UpdateUserInput,
  actor: UserProfile | null
): Promise<UserProfile> {
  const { data, error } = await supabase.from(TABLE).update(input).eq('id', id).select('*').single();
  throwIfError(error);

  await logActivity(supabase, {
    actor,
    action: 'update',
    entity: 'users',
    entityId: id,
    description: `Memperbarui pengguna "${data.name}"`,
  });
  return data as UserProfile;
}

/** Deactivates a staff account (soft alternative to deletion — see module note above). */
export async function deactivateUser(supabase: SupabaseClient, id: string, actor: UserProfile | null): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ is_active: false }).eq('id', id);
  throwIfError(error);
  await logActivity(supabase, { actor, action: 'update', entity: 'users', entityId: id, description: 'Menonaktifkan pengguna' });
}

/**
 * Permanently deletes a user: removes the Supabase Auth identity (service
 * role) which cascades to `public.users` via `on delete cascade`
 * (0001_init_schema.sql).
 */
export async function deleteUser(id: string, actor: UserProfile | null): Promise<void> {
  const adminClient = createAdminSupabaseClient();
  const { error } = await adminClient.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);
  await logActivity(adminClient, { actor, action: 'delete', entity: 'users', entityId: id, description: 'Menghapus pengguna' });
}

// =============================================================================
// Batch 3A-8 — Users & Profile additions below.
// =============================================================================

/**
 * Changes a user's role ("Ubah Role", admin-only — enforced by `requireRole`
 * at the API layer, same as every other write here). Logged as
 * `status_change` (not plain `update`) so the Activity Log reads clearly,
 * matching the convention already used for booking status transitions
 * (`booking.service.ts`).
 */
export async function changeUserRole(
  supabase: SupabaseClient,
  id: string,
  role: UserRole,
  actor: UserProfile | null
): Promise<UserProfile> {
  const { data, error } = await supabase.from(TABLE).update({ role }).eq('id', id).select('*').single();
  throwIfError(error);

  await logActivity(supabase, {
    actor,
    action: 'status_change',
    entity: 'users',
    entityId: id,
    description: `Mengubah role pengguna "${data.name}" menjadi ${role}`,
  });
  return data as UserProfile;
}

/**
 * Activates/deactivates a staff account ("Nonaktifkan/Aktifkan" — the
 * soft-delete substitute described in the module header comment above,
 * since `public.users` has no `deleted_at` column). Kept separate from the
 * plain `deactivateUser()` above so it can also re-activate and logs a
 * clearer `status_change` action either way.
 */
export async function setUserActive(
  supabase: SupabaseClient,
  id: string,
  isActive: boolean,
  actor: UserProfile | null
): Promise<UserProfile> {
  const { data, error } = await supabase.from(TABLE).update({ is_active: isActive }).eq('id', id).select('*').single();
  throwIfError(error);

  await logActivity(supabase, {
    actor,
    action: 'status_change',
    entity: 'users',
    entityId: id,
    description: isActive ? `Mengaktifkan pengguna "${data.name}"` : `Menonaktifkan pengguna "${data.name}"`,
  });
  return data as UserProfile;
}

/**
 * Admin "Reset Password": generates a random temporary password and sets it
 * directly on the Supabase Auth identity (service role,
 * `auth.admin.updateUserById`) — per the master prompt, "tanpa menyimpan
 * password di database aplikasi". The password is returned ONCE to the
 * caller (API route) to display to the admin; it is never written to
 * `public.users` or logged in `activity_logs` (only the fact that a reset
 * happened is logged, not the password value).
 */
export async function resetUserPassword(id: string, actor: UserProfile | null): Promise<{ password: string }> {
  const adminClient = createAdminSupabaseClient();
  const tempPassword = generateTempPassword();

  const { error } = await adminClient.auth.admin.updateUserById(id, { password: tempPassword });
  if (error) throw new Error(error.message);

  await logActivity(adminClient, {
    actor,
    action: 'reset_password',
    entity: 'users',
    entityId: id,
    description: 'Reset password pengguna',
  });
  return { password: tempPassword };
}

/**
 * Self-service "Ganti Password" (Profile page). Re-verifies the current
 * password via `signInWithPassword` before calling `auth.updateUser()` — an
 * already-authenticated `supabase` client would otherwise let anyone with a
 * live session change the password without proving they know the old one
 * (e.g. an unattended, still-logged-in browser tab).
 */
export async function changeOwnPassword(
  supabase: SupabaseClient,
  user: UserProfile,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) {
    throw new Error('Password saat ini tidak sesuai.');
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) throw new Error(updateError.message);

  await logActivity(supabase, {
    actor: user,
    action: 'change_password',
    entity: 'users',
    entityId: user.id,
    description: 'Mengubah password sendiri',
  });
}
