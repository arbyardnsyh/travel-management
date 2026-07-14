// =============================================================================
// FAQ service — centralizes all `public.faq` Supabase access.
// Batch 3A-4: adds soft delete / restore / permanent delete (see
// supabase/migrations/0007_soft_delete_testimonials_faq.sql), following the
// exact same pattern already used by gallery.service.ts /
// destination.service.ts / tour.service.ts. FAQ also keeps its `reorder()`
// bulk operation for move-up/move-down sort_order (see ARCHITECTURE.md §9
// exceptions).
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Faq, Paginated, UserProfile, ContentStatus } from '@/lib/database.types';
import { logActivity } from '@/lib/activity-log';
import { resolvePageParams, toPaginated, throwIfError, type BaseListParams } from './_shared';

const TABLE = 'faq';

export interface ListFaqParams extends BaseListParams {
  status?: ContentStatus;
  /** When true, lists soft-deleted (archived) rows instead of active ones — powers `/admin/faq/trash`. */
  onlyDeleted?: boolean;
}

export interface FaqInput {
  question: string;
  answer: string;
  sort_order?: number;
  status?: ContentStatus;
}

export async function listFaqs(supabase: SupabaseClient, params: ListFaqParams = {}): Promise<Paginated<Faq>> {
  const { page, perPage, from, to } = resolvePageParams(params);

  let query = supabase.from(TABLE).select('*', { count: 'exact' });
  query = params.onlyDeleted ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null);
  if (params.status) query = query.eq('status', params.status);
  if (params.q) query = query.ilike('question', `%${params.q}%`);

  const { data, count, error } = await query.order('sort_order', { ascending: true }).range(from, to);
  throwIfError(error);
  return toPaginated(data as Faq[] | null, count, page, perPage);
}

/** All published FAQs ordered for the public accordion (no pagination needed). */
export async function listPublishedFaqs(supabase: SupabaseClient): Promise<Faq[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });
  throwIfError(error);
  return (data as Faq[]) ?? [];
}

export async function getFaqById(supabase: SupabaseClient, id: string): Promise<Faq | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  throwIfError(error);
  return (data as Faq | null) ?? null;
}

/**
 * Count of active (non-deleted) FAQ entries — powers the Dashboard "Total
 * FAQ" stat card (Batch 3A-10).
 */
export async function countFaqs(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase.from(TABLE).select('id', { count: 'exact', head: true }).is('deleted_at', null);
  throwIfError(error);
  return count ?? 0;
}

export async function createFaq(supabase: SupabaseClient, input: FaqInput, actor: UserProfile | null): Promise<Faq> {
  const { data, error } = await supabase.from(TABLE).insert(input).select('*').single();
  throwIfError(error);

  await logActivity(supabase, {
    actor,
    action: 'create',
    entity: 'faq',
    entityId: data.id,
    description: `Menambahkan pertanyaan FAQ "${data.question}"`,
  });
  return data as Faq;
}

export async function updateFaq(
  supabase: SupabaseClient,
  id: string,
  input: Partial<FaqInput>,
  actor: UserProfile | null
): Promise<Faq> {
  const { data, error } = await supabase.from(TABLE).update(input).eq('id', id).select('*').single();
  throwIfError(error);

  await logActivity(supabase, { actor, action: 'update', entity: 'faq', entityId: id, description: `Memperbarui FAQ "${data.question}"` });
  return data as Faq;
}

/** Soft delete (default). Row stays in the DB with `deleted_at` set, hidden from public + normal admin lists. */
export async function softDeleteFaq(supabase: SupabaseClient, id: string, actor: UserProfile | null): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ deleted_at: new Date().toISOString() }).eq('id', id);
  throwIfError(error);
  await logActivity(supabase, { actor, action: 'soft_delete', entity: 'faq', entityId: id, description: 'Menghapus (arsip) FAQ' });
}

/** Restores a soft-deleted FAQ from `/admin/faq/trash`. */
export async function restoreFaq(supabase: SupabaseClient, id: string, actor: UserProfile | null): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ deleted_at: null }).eq('id', id);
  throwIfError(error);
  await logActivity(supabase, { actor, action: 'restore', entity: 'faq', entityId: id, description: 'Memulihkan FAQ dari arsip' });
}

/** Permanently deletes a FAQ row. Admin-only — enforced by the calling API route via requireRole(). */
export async function hardDeleteFaq(supabase: SupabaseClient, id: string, actor: UserProfile | null): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  throwIfError(error);
  await logActivity(supabase, { actor, action: 'delete', entity: 'faq', entityId: id, description: 'Menghapus permanen FAQ' });
}

/** Bulk-updates `sort_order` for move-up/move-down reordering. `order` is an array of FAQ ids in the new order. */
export async function reorderFaqs(supabase: SupabaseClient, order: string[], actor: UserProfile | null): Promise<void> {
  const updates = order.map((id, index) => supabase.from(TABLE).update({ sort_order: index }).eq('id', id));
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  throwIfError(failed?.error ?? null);

  await logActivity(supabase, {
    actor,
    action: 'update',
    entity: 'faq',
    description: 'Mengubah urutan FAQ',
    metadata: { order },
  });
}
