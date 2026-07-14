// =============================================================================
// Testimonial service — centralizes all `public.testimonials` Supabase access.
// Batch 3A-4: admin moderates testimonials submitted from the public site
// (`/testimonials`). No admin-side Create (testimonials only ever originate
// from the public form) — admin gets List/Search/Filter/Sort/Pagination/
// Detail/Edit/Approve/Unapprove/Soft Delete/Restore/Permanent Delete, mirroring
// the soft-delete pattern in gallery.service.ts (see
// supabase/migrations/0007_soft_delete_testimonials_faq.sql).
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Testimonial, Paginated, UserProfile, ModerationStatus } from '@/lib/database.types';
import { logActivity } from '@/lib/activity-log';
import { deleteImage } from '@/utils/storage';
import { resolvePageParams, toPaginated, throwIfError, type BaseListParams } from './_shared';

const TABLE = 'testimonials';

export interface ListTestimonialsParams extends BaseListParams {
  status?: ModerationStatus;
  /** When true, lists soft-deleted (archived) rows instead of active ones — powers `/admin/testimonials/trash`. */
  onlyDeleted?: boolean;
}

export interface TestimonialInput {
  name: string;
  job?: string | null;
  photo?: string | null;
  rating: number;
  message: string;
}

/** Staff-only paginated list (admin `/admin/testimonials`, Batch 3A-4). */
export async function listTestimonials(
  supabase: SupabaseClient,
  params: ListTestimonialsParams = {}
): Promise<Paginated<Testimonial>> {
  const { page, perPage, from, to } = resolvePageParams(params);

  let query = supabase.from(TABLE).select('*', { count: 'exact' });
  query = params.onlyDeleted ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null);
  if (params.status) query = query.eq('status', params.status);
  if (params.q) query = query.ilike('name', `%${params.q}%`);

  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to);
  throwIfError(error);
  return toPaginated(data as Testimonial[] | null, count, page, perPage);
}

/** All approved testimonials for the public Swiper (no pagination needed). */
export async function listApprovedTestimonials(supabase: SupabaseClient, limit?: number): Promise<Testimonial[]> {
  let query = supabase
    .from(TABLE)
    .select('*')
    .eq('status', 'approved')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  throwIfError(error);
  return (data as Testimonial[]) ?? [];
}

export async function getTestimonialById(supabase: SupabaseClient, id: string): Promise<Testimonial | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  throwIfError(error);
  return (data as Testimonial | null) ?? null;
}

/**
 * Count of active (non-deleted) testimonials — powers the Dashboard "Total
 * Testimonials" stat card (Batch 3A-10).
 */
export async function countTestimonials(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase.from(TABLE).select('id', { count: 'exact', head: true }).is('deleted_at', null);
  throwIfError(error);
  return count ?? 0;
}

/** Public insert — called from `/api/public/testimonial` (Batch 2). Always lands as status='pending' (DB default). No auth/actor required; RLS allows anonymous insert. */
export async function createTestimonial(supabase: SupabaseClient, input: TestimonialInput): Promise<Testimonial> {
  const { data, error } = await supabase.from(TABLE).insert({ ...input, status: 'pending' }).select('*').single();
  throwIfError(error);

  await logActivity(supabase, {
    actor: null,
    action: 'create',
    entity: 'testimonials',
    entityId: data.id,
    description: `Testimoni baru dari ${data.name}`,
  });
  return data as Testimonial;
}

/**
 * Staff-only edit (admin acts as moderator — can correct typos/content
 * before/after approving). Cleans up the old photo in Storage if it's
 * replaced with a new upload, same approach as updateGalleryItem().
 */
export async function updateTestimonial(
  supabase: SupabaseClient,
  id: string,
  input: Partial<TestimonialInput>,
  actor: UserProfile | null
): Promise<Testimonial> {
  const previous = await getTestimonialById(supabase, id);

  const { data, error } = await supabase.from(TABLE).update(input).eq('id', id).select('*').single();
  throwIfError(error);

  if (previous?.photo && input.photo !== undefined && input.photo !== previous.photo) {
    await deleteImage(supabase, previous.photo);
  }

  await logActivity(supabase, {
    actor,
    action: 'update',
    entity: 'testimonials',
    entityId: id,
    description: `Memperbarui testimoni "${data.name}"`,
  });
  return data as Testimonial;
}

/** Generic staff-only moderation — sets `status` to any moderation value. Used by approve/unapprove below. */
export async function moderateTestimonial(
  supabase: SupabaseClient,
  id: string,
  status: ModerationStatus,
  actor: UserProfile | null
): Promise<Testimonial> {
  const { data, error } = await supabase.from(TABLE).update({ status }).eq('id', id).select('*').single();
  throwIfError(error);

  await logActivity(supabase, {
    actor,
    action: 'status_change',
    entity: 'testimonials',
    entityId: id,
    description: `Mengubah status testimoni menjadi "${status}"`,
    metadata: { status },
  });
  return data as Testimonial;
}

/** Approves a pending testimonial so it appears on the public `/testimonials` page. */
export async function approveTestimonial(supabase: SupabaseClient, id: string, actor: UserProfile | null): Promise<Testimonial> {
  return moderateTestimonial(supabase, id, 'approved', actor);
}

/** Reverts an approved testimonial back to `pending`, removing it from the public page without deleting it. */
export async function unapproveTestimonial(supabase: SupabaseClient, id: string, actor: UserProfile | null): Promise<Testimonial> {
  return moderateTestimonial(supabase, id, 'pending', actor);
}

/** Soft delete (default). Row stays in the DB with `deleted_at` set, hidden from public + normal admin lists. */
export async function softDeleteTestimonial(supabase: SupabaseClient, id: string, actor: UserProfile | null): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ deleted_at: new Date().toISOString() }).eq('id', id);
  throwIfError(error);
  await logActivity(supabase, { actor, action: 'soft_delete', entity: 'testimonials', entityId: id, description: 'Menghapus (arsip) testimoni' });
}

/** Restores a soft-deleted testimonial from `/admin/testimonials/trash`. */
export async function restoreTestimonial(supabase: SupabaseClient, id: string, actor: UserProfile | null): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ deleted_at: null }).eq('id', id);
  throwIfError(error);
  await logActivity(supabase, { actor, action: 'restore', entity: 'testimonials', entityId: id, description: 'Memulihkan testimoni dari arsip' });
}

/** Permanently deletes a testimonial row + its photo. Admin-only — enforced by the calling API route via requireRole(). */
export async function hardDeleteTestimonial(supabase: SupabaseClient, id: string, actor: UserProfile | null): Promise<void> {
  const item = await getTestimonialById(supabase, id);

  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  throwIfError(error);

  if (item?.photo) await deleteImage(supabase, item.photo);

  await logActivity(supabase, { actor, action: 'delete', entity: 'testimonials', entityId: id, description: 'Menghapus permanen testimoni' });
}
