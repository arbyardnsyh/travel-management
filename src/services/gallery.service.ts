// =============================================================================
// Gallery service — centralizes all `public.gallery` Supabase access
// (Enhancement Batch). Unlike destinations/tours/blogs, gallery items have
// no slug/status — just a title, image, and category.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { GalleryItem, Paginated, UserProfile } from '@/lib/database.types';
import { logActivity } from '@/lib/activity-log';
import { deleteImage } from '@/utils/storage';
import { resolvePageParams, toPaginated, throwIfError, type BaseListParams } from './_shared';

const TABLE = 'gallery';

export interface ListGalleryParams extends BaseListParams {
  category?: string;
  onlyDeleted?: boolean;
}

export interface GalleryItemInput {
  title: string;
  image_url: string;
  category?: string | null;
}

export async function listGallery(
  supabase: SupabaseClient,
  params: ListGalleryParams = {}
): Promise<Paginated<GalleryItem>> {
  const { page, perPage, from, to } = resolvePageParams(params);

  let query = supabase.from(TABLE).select('*', { count: 'exact' });
  query = params.onlyDeleted ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null);
  if (params.category) query = query.eq('category', params.category);
  if (params.q) query = query.ilike('title', `%${params.q}%`);

  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to);
  throwIfError(error);
  return toPaginated(data as GalleryItem[] | null, count, page, perPage);
}

export async function getGalleryItemById(supabase: SupabaseClient, id: string): Promise<GalleryItem | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  throwIfError(error);
  return (data as GalleryItem | null) ?? null;
}

/**
 * Count of active (non-deleted) gallery photos — powers the Dashboard
 * "Total Gallery" stat card (Batch 3A-10).
 */
export async function countGalleryItems(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase.from(TABLE).select('id', { count: 'exact', head: true }).is('deleted_at', null);
  throwIfError(error);
  return count ?? 0;
}

export async function createGalleryItem(
  supabase: SupabaseClient,
  input: GalleryItemInput,
  actor: UserProfile | null
): Promise<GalleryItem> {
  const { data, error } = await supabase.from(TABLE).insert(input).select('*').single();
  throwIfError(error);

  await logActivity(supabase, {
    actor,
    action: 'create',
    entity: 'gallery',
    entityId: data.id,
    description: `Menambahkan foto galeri "${data.title}"`,
  });
  return data as GalleryItem;
}

export async function updateGalleryItem(
  supabase: SupabaseClient,
  id: string,
  input: Partial<GalleryItemInput>,
  actor: UserProfile | null
): Promise<GalleryItem> {
  // Fetch the previous image path first so we can clean up storage when it's
  // replaced with a new upload (avoids orphaned files in the `media` bucket),
  // same approach as updateTour()/updateDestination().
  const previous = await getGalleryItemById(supabase, id);

  const { data, error } = await supabase.from(TABLE).update(input).eq('id', id).select('*').single();
  throwIfError(error);

  if (previous?.image_url && input.image_url !== undefined && input.image_url !== previous.image_url) {
    await deleteImage(supabase, previous.image_url);
  }

  await logActivity(supabase, {
    actor,
    action: 'update',
    entity: 'gallery',
    entityId: id,
    description: `Memperbarui foto galeri "${data.title}"`,
  });
  return data as GalleryItem;
}

export async function softDeleteGalleryItem(supabase: SupabaseClient, id: string, actor: UserProfile | null): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ deleted_at: new Date().toISOString() }).eq('id', id);
  throwIfError(error);
  await logActivity(supabase, { actor, action: 'soft_delete', entity: 'gallery', entityId: id, description: 'Menghapus (arsip) foto galeri' });
}

export async function restoreGalleryItem(supabase: SupabaseClient, id: string, actor: UserProfile | null): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ deleted_at: null }).eq('id', id);
  throwIfError(error);
  await logActivity(supabase, { actor, action: 'restore', entity: 'gallery', entityId: id, description: 'Memulihkan foto galeri dari arsip' });
}

export async function hardDeleteGalleryItem(supabase: SupabaseClient, id: string, actor: UserProfile | null): Promise<void> {
  const item = await getGalleryItemById(supabase, id);

  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  throwIfError(error);

  if (item?.image_url) await deleteImage(supabase, item.image_url);

  await logActivity(supabase, { actor, action: 'delete', entity: 'gallery', entityId: id, description: 'Menghapus permanen foto galeri' });
}

/** Distinct, non-empty category values across active (non-deleted) gallery items — powers the list filter dropdown. */
export async function listGalleryCategories(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from(TABLE).select('category').is('deleted_at', null).not('category', 'is', null);
  throwIfError(error);
  const values = ((data ?? []) as Array<{ category: string | null }>).map((row) => row.category).filter((c): c is string => !!c);
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}
