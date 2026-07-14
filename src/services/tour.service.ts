// =============================================================================
// Tour service — centralizes all `public.tours` Supabase access
// (Enhancement Batch). See destination.service.ts for the shared pattern
// (soft delete default, activity logging on every write).
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tour, Paginated, UserProfile, ContentStatus } from '@/lib/database.types';
import { logActivity } from '@/lib/activity-log';
import { generateUniqueSlug } from '@/utils/slug';
import { deleteImage } from '@/utils/storage';
import { resolvePageParams, toPaginated, throwIfError, type BaseListParams } from './_shared';

const TABLE = 'tours';
const WITH_DESTINATION_SELECT = '*, destination:destinations(id, name, slug, location)';

export interface ListToursParams extends BaseListParams {
  status?: ContentStatus;
  destinationId?: string;
  onlyDeleted?: boolean;
}

export interface TourInput {
  destination_id?: string | null;
  title: string;
  slug?: string;
  price: number;
  duration?: string | null;
  quota?: number;
  description?: string | null;
  thumbnail?: string | null;
  status?: ContentStatus;
}

export async function listTours(supabase: SupabaseClient, params: ListToursParams = {}): Promise<Paginated<Tour>> {
  const { page, perPage, from, to } = resolvePageParams(params);

  let query = supabase.from(TABLE).select(WITH_DESTINATION_SELECT, { count: 'exact' });
  query = params.onlyDeleted ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null);
  if (params.status) query = query.eq('status', params.status);
  if (params.destinationId) query = query.eq('destination_id', params.destinationId);
  if (params.q) query = query.ilike('title', `%${params.q}%`);

  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to);
  throwIfError(error);
  return toPaginated(data as unknown as Tour[] | null, count, page, perPage);
}

/**
 * Count of active (non-deleted) tours — powers the Dashboard "Total Tours"
 * stat card (Batch 3A-10).
 */
export async function countTours(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase.from(TABLE).select('id', { count: 'exact', head: true }).is('deleted_at', null);
  throwIfError(error);
  return count ?? 0;
}

export async function getTourById(supabase: SupabaseClient, id: string): Promise<Tour | null> {
  const { data, error } = await supabase.from(TABLE).select(WITH_DESTINATION_SELECT).eq('id', id).maybeSingle();
  throwIfError(error);
  return (data as unknown as Tour | null) ?? null;
}

export async function getTourBySlug(supabase: SupabaseClient, slug: string): Promise<Tour | null> {
  const { data, error } = await supabase.from(TABLE).select(WITH_DESTINATION_SELECT).eq('slug', slug).maybeSingle();
  throwIfError(error);
  return (data as unknown as Tour | null) ?? null;
}

async function isSlugTaken(supabase: SupabaseClient, slug: string, excludeId?: string): Promise<boolean> {
  let query = supabase.from(TABLE).select('id', { count: 'exact', head: true }).eq('slug', slug);
  if (excludeId) query = query.neq('id', excludeId);
  const { count } = await query;
  return (count ?? 0) > 0;
}

export async function createTour(supabase: SupabaseClient, input: TourInput, actor: UserProfile | null): Promise<Tour> {
  const slug = input.slug?.trim()
    ? input.slug.trim()
    : await generateUniqueSlug(input.title, (candidate) => isSlugTaken(supabase, candidate));

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, slug, created_by: actor?.id ?? null })
    .select('*')
    .single();
  throwIfError(error);

  await logActivity(supabase, {
    actor,
    action: 'create',
    entity: 'tours',
    entityId: data.id,
    description: `Menambahkan tour "${data.title}"`,
  });
  return data as Tour;
}

export async function updateTour(
  supabase: SupabaseClient,
  id: string,
  input: Partial<TourInput>,
  actor: UserProfile | null
): Promise<Tour> {
  const payload: Partial<TourInput> = { ...input };
  if (input.slug?.trim()) {
    payload.slug = (await isSlugTaken(supabase, input.slug.trim(), id))
      ? await generateUniqueSlug(input.slug.trim(), (candidate) => isSlugTaken(supabase, candidate, id))
      : input.slug.trim();
  }

  // Fetch the previous thumbnail path so we can clean up storage when it's
  // replaced with a new upload (avoids orphaned files in the `media` bucket).
  const previous = await getTourById(supabase, id);

  const { data, error } = await supabase.from(TABLE).update(payload).eq('id', id).select('*').single();
  throwIfError(error);

  if (previous?.thumbnail && payload.thumbnail !== undefined && payload.thumbnail !== previous.thumbnail) {
    await deleteImage(supabase, previous.thumbnail);
  }

  await logActivity(supabase, {
    actor,
    action: 'update',
    entity: 'tours',
    entityId: id,
    description: `Memperbarui tour "${data.title}"`,
  });
  return data as Tour;
}

export async function softDeleteTour(supabase: SupabaseClient, id: string, actor: UserProfile | null): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ deleted_at: new Date().toISOString() }).eq('id', id);
  throwIfError(error);
  await logActivity(supabase, { actor, action: 'soft_delete', entity: 'tours', entityId: id, description: 'Menghapus (arsip) tour' });
}

export async function restoreTour(supabase: SupabaseClient, id: string, actor: UserProfile | null): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ deleted_at: null }).eq('id', id);
  throwIfError(error);
  await logActivity(supabase, { actor, action: 'restore', entity: 'tours', entityId: id, description: 'Memulihkan tour dari arsip' });
}

/**
 * Permanently deletes a tour row. NOTE: `bookings.tour_id` uses `ON DELETE
 * RESTRICT` (see ARCHITECTURE.md §6) — this will throw if the tour has any
 * bookings. Prefer softDeleteTour() for tours with booking history.
 */
export async function hardDeleteTour(supabase: SupabaseClient, id: string, actor: UserProfile | null): Promise<void> {
  const tour = await getTourById(supabase, id);

  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  throwIfError(error);

  if (tour?.thumbnail) await deleteImage(supabase, tour.thumbnail);

  await logActivity(supabase, { actor, action: 'delete', entity: 'tours', entityId: id, description: 'Menghapus permanen tour' });
}
