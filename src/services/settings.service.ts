// =============================================================================
// Settings service — centralizes all `public.settings` Supabase access
// (Enhancement Batch). `settings` is a single-row table (enforced by the
// `uq_settings_singleton` unique index in 0001_init_schema.sql) — there is no
// list/create/delete, only get + update (ARCHITECTURE.md §9 exceptions).
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { SiteSettings, UserProfile } from '@/lib/database.types';
import { logActivity } from '@/lib/activity-log';
import { throwIfError } from './_shared';

const TABLE = 'settings';

export type SettingsInput = Partial<Omit<SiteSettings, 'id' | 'updated_at'>>;

/** Fetches the single settings row, used by PublicLayout/Header/Footer/SEO and the admin settings form. */
export async function getSettings(supabase: SupabaseClient): Promise<SiteSettings | null> {
  const { data, error } = await supabase.from(TABLE).select('*').maybeSingle();
  throwIfError(error);
  return (data as SiteSettings | null) ?? null;
}

/**
 * Updates the single settings row. If no row exists yet, creates it instead
 * (defensive — normally `0004_seed.sql` already inserts the initial row).
 */
export async function updateSettings(
  supabase: SupabaseClient,
  input: SettingsInput,
  actor: UserProfile | null
): Promise<SiteSettings> {
  const existing = await getSettings(supabase);

  const { data, error } = existing
    ? await supabase.from(TABLE).update(input).eq('id', existing.id).select('*').single()
    : await supabase.from(TABLE).insert(input).select('*').single();
  throwIfError(error);

  await logActivity(supabase, {
    actor,
    action: 'update',
    entity: 'settings',
    entityId: data.id,
    description: 'Memperbarui pengaturan situs',
  });
  return data as SiteSettings;
}
