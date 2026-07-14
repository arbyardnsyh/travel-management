// =============================================================================
// Contact message service — centralizes all `public.contacts` Supabase
// access. Public insert added in Batch 2. Batch 3A-11 completes the
// staff-side admin module (`/admin/contacts`): List/Search/Filter(read/
// unread)/Sort/Pagination/Detail/Mark Read/Mark Unread/Soft Delete/Restore/
// Permanent Delete — mirrors the soft-delete pattern already used by
// testimonials/faq/bookings (see
// supabase/migrations/0010_soft_delete_contacts.sql).
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContactMessage, Paginated, UserProfile } from '@/lib/database.types';
import { logActivity } from '@/lib/activity-log';
import { resolvePageParams, toPaginated, throwIfError, type BaseListParams } from './_shared';

const TABLE = 'contacts';

export interface ListContactsParams extends BaseListParams {
  onlyUnread?: boolean;
  /** Explicit read/unread filter — true = only read, false = only unread. Prefer this (or onlyUnread) over client-side filtering so pagination counts stay accurate. */
  isRead?: boolean;
  /** When true, lists soft-deleted (archived) rows instead of active ones — powers `/admin/contacts/trash`. */
  onlyDeleted?: boolean;
}

export interface ContactMessageInput {
  name: string;
  email: string;
  subject?: string | null;
  message: string;
}

/** Staff-only paginated list (admin `/admin/contacts`, Batch 3A-11). */
export async function listContacts(
  supabase: SupabaseClient,
  params: ListContactsParams = {}
): Promise<Paginated<ContactMessage>> {
  const { page, perPage, from, to } = resolvePageParams(params);

  let query = supabase.from(TABLE).select('*', { count: 'exact' });
  query = params.onlyDeleted ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null);
  if (params.onlyUnread) query = query.eq('is_read', false);
  if (params.isRead !== undefined) query = query.eq('is_read', params.isRead);
  if (params.q) query = query.or(`name.ilike.%${params.q}%,email.ilike.%${params.q}%,subject.ilike.%${params.q}%`);

  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to);
  throwIfError(error);
  return toPaginated(data as ContactMessage[] | null, count, page, perPage);
}

/** Backward-compatible alias — kept because `dashboard.service.ts` already imports this name. */
export const listContactMessages = listContacts;

export async function getContactById(supabase: SupabaseClient, id: string): Promise<ContactMessage | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  throwIfError(error);
  return (data as ContactMessage | null) ?? null;
}

/** Backward-compatible alias. */
export const getContactMessageById = getContactById;

/** Total count of active (non-deleted) contact messages — powers the Dashboard "Total Contacts" stat card (Batch 3A-10). */
export async function countContacts(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase.from(TABLE).select('id', { count: 'exact', head: true }).is('deleted_at', null);
  throwIfError(error);
  return count ?? 0;
}

/** Count of active, unread contact messages — powers the Dashboard "Unread Messages" stat card (Batch 3A-11). */
export async function countUnreadContacts(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .eq('is_read', false);
  throwIfError(error);
  return count ?? 0;
}

/** Public insert — called from `/api/public/contact` (Batch 2). No auth/actor required; RLS allows anonymous insert. */
export async function createContactMessage(supabase: SupabaseClient, input: ContactMessageInput): Promise<ContactMessage> {
  const { data, error } = await supabase.from(TABLE).insert(input).select('*').single();
  throwIfError(error);

  await logActivity(supabase, {
    actor: null,
    action: 'create',
    entity: 'contacts',
    entityId: data.id,
    description: `Pesan baru dari ${data.name}`,
  });
  return data as ContactMessage;
}

/** Generic staff-only read-status setter — sets `is_read` to any boolean value. Used by markContactRead/markContactUnread below. */
export async function updateContactReadStatus(
  supabase: SupabaseClient,
  id: string,
  isRead: boolean,
  actor: UserProfile | null
): Promise<ContactMessage> {
  const { data, error } = await supabase.from(TABLE).update({ is_read: isRead }).eq('id', id).select('*').single();
  throwIfError(error);
  await logActivity(supabase, {
    actor,
    action: isRead ? 'read' : 'unread',
    entity: 'contacts',
    entityId: id,
    description: isRead ? 'Menandai pesan sebagai dibaca' : 'Menandai pesan sebagai belum dibaca',
  });
  return data as ContactMessage;
}

/** Marks a contact message as read. */
export async function markContactRead(supabase: SupabaseClient, id: string, actor: UserProfile | null): Promise<ContactMessage> {
  return updateContactReadStatus(supabase, id, true, actor);
}

/** Marks a contact message as unread. */
export async function markContactUnread(supabase: SupabaseClient, id: string, actor: UserProfile | null): Promise<ContactMessage> {
  return updateContactReadStatus(supabase, id, false, actor);
}

/** Backward-compatible alias — old name for markContactRead(). */
export const markContactMessageRead = markContactRead;

/** Soft delete (default). Row stays in the DB with `deleted_at` set, hidden from normal admin lists. */
export async function softDeleteContact(supabase: SupabaseClient, id: string, actor: UserProfile | null): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ deleted_at: new Date().toISOString() }).eq('id', id);
  throwIfError(error);
  await logActivity(supabase, { actor, action: 'soft_delete', entity: 'contacts', entityId: id, description: 'Menghapus (arsip) pesan kontak' });
}

/** Restores a soft-deleted contact message from `/admin/contacts/trash`. */
export async function restoreContact(supabase: SupabaseClient, id: string, actor: UserProfile | null): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ deleted_at: null }).eq('id', id);
  throwIfError(error);
  await logActivity(supabase, { actor, action: 'restore', entity: 'contacts', entityId: id, description: 'Memulihkan pesan kontak dari arsip' });
}

/** Permanently deletes a contact message row. Admin-only — enforced by the calling API route via requireRole(). */
export async function hardDeleteContact(supabase: SupabaseClient, id: string, actor: UserProfile | null): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  throwIfError(error);
  await logActivity(supabase, { actor, action: 'permanent_delete', entity: 'contacts', entityId: id, description: 'Menghapus permanen pesan kontak' });
}
