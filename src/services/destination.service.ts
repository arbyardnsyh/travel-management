// =============================================================================
// Destination service — centralizes all `public.destinations` Supabase access
// (Enhancement Batch). Pages/API routes should call these functions instead
// of building `.from('destinations')` queries directly, so soft-delete
// filtering and activity logging stay consistent everywhere.
//
// All functions accept the caller's Supabase client (usually
// `Astro.locals.supabase`) so RLS keeps applying as-is (public vs staff).
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Destination, DestinationGalleryItem, Paginated, UserProfile, ContentStatus } from '@/lib/database.types';
import { logActivity } from '@/lib/activity-log';
import { generateUniqueSlug } from '@/utils/slug';
import { deleteImage } from '@/utils/storage';
import { resolvePageParams, toPaginated, throwIfError, type BaseListParams } from './_shared';

const TABLE = 'destinations';

export interface ListDestinationsParams extends BaseListParams {
  status?: ContentStatus;
  featuredOnly?: boolean;
  /** Trash view (Batch 3 admin only) — when true, only soft-deleted rows are returned. */
  onlyDeleted?: boolean;
}

export interface DestinationInput {
  name: string;
  slug?: string;
  location: string;
  price: number;
  duration?: string | null;
  rating?: number;
  description?: string | null;
  thumbnail?: string | null;
  cover_image?: string | null;
  is_featured?: boolean;
  status?: ContentStatus;
}

/** Paginated list of destinations. By default excludes soft-deleted rows (matches existing public behavior). */
export async function listDestinations(
  supabase: SupabaseClient,
  params: ListDestinationsParams = {}
): Promise<Paginated<Destination>> {
  const { page, perPage, from, to } = resolvePageParams(params);

  let query = supabase.from(TABLE).select('*', { count: 'exact' });
  query = params.onlyDeleted ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null);
  if (params.status) query = query.eq('status', params.status);
  if (params.featuredOnly) query = query.eq('is_featured', true);
  if (params.q) query = query.ilike('name', `%${params.q}%`);

  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to);
  throwIfError(error);
  return toPaginated(data as Destination[] | null, count, page, perPage);
}

/**
 * Count of active (non-deleted) destinations — powers the Dashboard "Total
 * Destinations" stat card (Batch 3A-10). Uses `head: true` so no rows are
 * transferred, just the count.
 */
export async function countDestinations(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase.from(TABLE).select('id', { count: 'exact', head: true }).is('deleted_at', null);
  throwIfError(error);
  return count ?? 0;
}

export async function getDestinationById(supabase: SupabaseClient, id: string): Promise<Destination | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  throwIfError(error);
  return (data as Destination | null) ?? null;
}

/** Fetches a single published, non-deleted destination by slug (for public detail pages). */
export async function getDestinationBySlug(supabase: SupabaseClient, slug: string): Promise<Destination | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('slug', slug).maybeSingle();
  throwIfError(error);
  return (data as Destination | null) ?? null;
}

async function isSlugTaken(supabase: SupabaseClient, slug: string, excludeId?: string): Promise<boolean> {
  let query = supabase.from(TABLE).select('id', { count: 'exact', head: true }).eq('slug', slug);
  if (excludeId) query = query.neq('id', excludeId);
  const { count } = await query;
  return (count ?? 0) > 0;
}

export async function createDestination(
  supabase: SupabaseClient,
  input: DestinationInput,
  actor: UserProfile | null
): Promise<Destination> {
  const slug = input.slug?.trim()
    ? input.slug.trim()
    : await generateUniqueSlug(input.name, (candidate) => isSlugTaken(supabase, candidate));

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, slug, created_by: actor?.id ?? null })
    .select('*')
    .single();
  throwIfError(error);

  await logActivity(supabase, {
    actor,
    action: 'create',
    entity: 'destinations',
    entityId: data.id,
    description: `Menambahkan destinasi "${data.name}"`,
  });
  return data as Destination;
}

export async function updateDestination(
  supabase: SupabaseClient,
  id: string,
  input: Partial<DestinationInput>,
  actor: UserProfile | null
): Promise<Destination> {
  const payload: Partial<DestinationInput> = { ...input };
  if (input.slug?.trim()) {
    payload.slug = (await isSlugTaken(supabase, input.slug.trim(), id))
      ? await generateUniqueSlug(input.slug.trim(), (candidate) => isSlugTaken(supabase, candidate, id))
      : input.slug.trim();
  }

  // Fetch the previous image paths so we can clean up storage when they're
  // replaced with a new upload (avoids orphaned files in the `media` bucket).
  const previous = await getDestinationById(supabase, id);

  const { data, error } = await supabase.from(TABLE).update(payload).eq('id', id).select('*').single();
  throwIfError(error);

  if (previous?.thumbnail && payload.thumbnail !== undefined && payload.thumbnail !== previous.thumbnail) {
    await deleteImage(supabase, previous.thumbnail);
  }
  if (previous?.cover_image && payload.cover_image !== undefined && payload.cover_image !== previous.cover_image) {
    await deleteImage(supabase, previous.cover_image);
  }

  await logActivity(supabase, {
    actor,
    action: 'update',
    entity: 'destinations',
    entityId: id,
    description: `Memperbarui destinasi "${data.name}"`,
  });
  return data as Destination;
}

/** Soft delete (default). Row stays in the DB with `deleted_at` set, hidden from public + normal admin lists. */
export async function softDeleteDestination(
  supabase: SupabaseClient,
  id: string,
  actor: UserProfile | null
): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ deleted_at: new Date().toISOString() }).eq('id', id);
  throwIfError(error);
  await logActivity(supabase, {
    actor,
    action: 'soft_delete',
    entity: 'destinations',
    entityId: id,
    description: 'Menghapus (arsip) destinasi',
  });
}

/** Restores a soft-deleted destination. */
export async function restoreDestination(
  supabase: SupabaseClient,
  id: string,
  actor: UserProfile | null
): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ deleted_at: null }).eq('id', id);
  throwIfError(error);
  await logActivity(supabase, {
    actor,
    action: 'restore',
    entity: 'destinations',
    entityId: id,
    description: 'Memulihkan destinasi dari arsip',
  });
}

/** Photo gallery for a single destination's public detail page (`destination_gallery` table). */
export async function listDestinationGallery(
  supabase: SupabaseClient,
  destinationId: string
): Promise<DestinationGalleryItem[]> {
  const { data, error } = await supabase
    .from('destination_gallery')
    .select('*')
    .eq('destination_id', destinationId)
    .order('sort_order', { ascending: true });
  throwIfError(error);
  return (data as DestinationGalleryItem[]) ?? [];
}

/** Permanently deletes a destination row. Use sparingly (e.g. emptying trash) — prefer softDeleteDestination(). */
export async function hardDeleteDestination(
  supabase: SupabaseClient,
  id: string,
  actor: UserProfile | null
): Promise<void> {
  const destination = await getDestinationById(supabase, id);
  const gallery = await listDestinationGallery(supabase, id);

  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  throwIfError(error);

  if (destination?.thumbnail) await deleteImage(supabase, destination.thumbnail);
  if (destination?.cover_image) await deleteImage(supabase, destination.cover_image);
  for (const photo of gallery) {
    if (photo.image_url) await deleteImage(supabase, photo.image_url);
  }

  await logActivity(supabase, {
    actor,
    action: 'delete',
    entity: 'destinations',
    entityId: id,
    description: 'Menghapus permanen destinasi',
  });
}

/** Adds a photo to a destination's gallery (`destination_gallery` table). */
export async function addDestinationGalleryPhoto(
  supabase: SupabaseClient,
  input: { destination_id: string; image_url: string; caption?: string | null; sort_order?: number },
  actor: UserProfile | null
): Promise<DestinationGalleryItem> {
  const { data, error } = await supabase
    .from('destination_gallery')
    .insert({
      destination_id: input.destination_id,
      image_url: input.image_url,
      caption: input.caption ?? null,
      sort_order: input.sort_order ?? 0,
    })
    .select('*')
    .single();
  throwIfError(error);

  await logActivity(supabase, {
    actor,
    action: 'update',
    entity: 'destinations',
    entityId: input.destination_id,
    description: 'Menambahkan foto galeri destinasi',
  });
  return data as DestinationGalleryItem;
}

/** Removes a photo from a destination's gallery and deletes the underlying storage file. */
export async function deleteDestinationGalleryPhoto(
  supabase: SupabaseClient,
  photoId: string,
  actor: UserProfile | null
): Promise<void> {
  const { data: photo } = await supabase
    .from('destination_gallery')
    .select('*')
    .eq('id', photoId)
    .maybeSingle();

  const { error } = await supabase.from('destination_gallery').delete().eq('id', photoId);
  throwIfError(error);

  if (photo?.image_url) {
    await deleteImage(supabase, photo.image_url);
  }

  await logActivity(supabase, {
    actor,
    action: 'update',
    entity: 'destinations',
    entityId: photo?.destination_id ?? null,
    description: 'Menghapus foto galeri destinasi',
  });
}
