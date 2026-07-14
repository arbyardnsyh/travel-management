// =============================================================================
// Static page service — centralizes all `public.pages` Supabase access
// (about/privacy/terms). Single-row-per-slug table, no soft delete, no
// pagination — just get by slug + staff-only update (Batch 3).
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { StaticPage, UserProfile } from '@/lib/database.types';
import { logActivity } from '@/lib/activity-log';
import { throwIfError } from './_shared';

const TABLE = 'pages';

export type PageInput = Partial<
  Pick<StaticPage, 'title' | 'content' | 'meta_title' | 'meta_description' | 'status' | 'published_at'>
>;

/** Human-readable label for activity log descriptions ("Memperbarui halaman About", not "...halaman about"). */
const PAGE_LABELS: Record<string, string> = {
  about: 'About',
  privacy: 'Privacy',
  terms: 'Terms',
};
const pageLabel = (slug: string) => PAGE_LABELS[slug] ?? slug;

export async function getPageBySlug(supabase: SupabaseClient, slug: string): Promise<StaticPage | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('slug', slug).maybeSingle();
  throwIfError(error);
  return (data as StaticPage | null) ?? null;
}

export async function listPages(supabase: SupabaseClient): Promise<StaticPage[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('slug', { ascending: true });
  throwIfError(error);
  return (data as StaticPage[]) ?? [];
}

/** Staff-only update. Upserts by slug if the row doesn't exist yet (defensive — normally seeded). */
export async function upsertPage(
  supabase: SupabaseClient,
  slug: string,
  input: PageInput,
  actor: UserProfile | null
): Promise<StaticPage> {
  const existing = await getPageBySlug(supabase, slug);

  const { data, error } = existing
    ? await supabase.from(TABLE).update(input).eq('id', existing.id).select('*').single()
    : await supabase.from(TABLE).insert({ slug, title: input.title ?? slug, ...input }).select('*').single();
  throwIfError(error);

  await logActivity(supabase, {
    actor,
    action: 'update',
    entity: 'pages',
    entityId: data.id,
    description: `Memperbarui halaman ${pageLabel(slug)}`,
  });
  return data as StaticPage;
}

/**
 * Publish action (Batch 3A-7) — distinct from a regular content update.
 * Sets `status = 'published'` + `published_at = now()` and logs a
 * `status_change` activity entry ("Mempublikasikan halaman About") separate
 * from the generic "Memperbarui halaman ..." entry `upsertPage()` produces,
 * per the master prompt's activity log requirements.
 */
export async function publishPage(supabase: SupabaseClient, slug: string, actor: UserProfile | null): Promise<StaticPage> {
  const existing = await getPageBySlug(supabase, slug);
  if (!existing) throw new Error(`Halaman "${slug}" tidak ditemukan.`);

  const publishedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: 'published', published_at: publishedAt })
    .eq('id', existing.id)
    .select('*')
    .single();
  throwIfError(error);

  await logActivity(supabase, {
    actor,
    action: 'status_change',
    entity: 'pages',
    entityId: data.id,
    description: `Mempublikasikan halaman ${pageLabel(slug)}`,
  });
  return data as StaticPage;
}
