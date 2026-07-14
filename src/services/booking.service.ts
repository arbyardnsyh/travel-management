// =============================================================================
// Booking service — centralizes all `public.bookings` Supabase access.
// Batch 3A-5: admin manages bookings submitted from the public `/booking`
// form. Per ARCHITECTURE.md §9 exceptions there is still no admin-side
// Create (bookings only ever originate from the public form), but the
// module now mirrors the full moderation pattern already established for
// testimonials/faq (see testimonial.service.ts) — List/Search/Filter/Sort/
// Pagination/Detail/Update/Status Change/Notes/Soft Delete/Restore/
// Permanent Delete — backed by `deleted_at` from
// supabase/migrations/0008_soft_delete_bookings.sql.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Booking, Paginated, UserProfile, BookingStatus } from '@/lib/database.types';
import { logActivity } from '@/lib/activity-log';
import { BOOKING_STATUSES } from '@/lib/constants';
import { resolvePageParams, toPaginated, throwIfError, type BaseListParams } from './_shared';

const TABLE = 'bookings';

// `tours!inner` (not the default left join) so `.eq('tour.destination_id', …)`
// below can filter on the embedded resource — safe because `bookings.tour_id`
// is `not null` (ON DELETE RESTRICT), so every booking always has a matching
// tour row.
const WITH_TOUR_SELECT = '*, tour:tours!inner(id, title, slug, price, destination_id, destination:destinations(id, name, slug))';

export interface ListBookingsParams extends BaseListParams {
  status?: BookingStatus;
  tourId?: string;
  destinationId?: string;
  /** When true, lists soft-deleted (archived) rows instead of active ones — powers `/admin/bookings/trash`. */
  onlyDeleted?: boolean;
}

export interface BookingInput {
  tour_id: string;
  customer_name: string;
  customer_email: string;
  phone: string;
  participants: number;
  travel_date: string;
  notes?: string | null;
}

/** Fields a staff member may correct on an existing booking (customer details + notes). Excludes `tour_id`/`status` — see booking.schema.ts. */
export interface BookingAdminUpdateInput {
  customer_name: string;
  customer_email: string;
  phone: string;
  participants: number;
  travel_date: string;
  notes?: string | null;
}

/** Staff-only paginated list (admin `/admin/bookings`). Search matches customer name/email/phone. */
export async function listBookings(
  supabase: SupabaseClient,
  params: ListBookingsParams = {}
): Promise<Paginated<Booking>> {
  const { page, perPage, from, to } = resolvePageParams(params);

  let query = supabase.from(TABLE).select(WITH_TOUR_SELECT, { count: 'exact' });
  query = params.onlyDeleted ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null);
  if (params.status) query = query.eq('status', params.status);
  if (params.tourId) query = query.eq('tour_id', params.tourId);
  if (params.destinationId) query = query.eq('tour.destination_id', params.destinationId);
  if (params.q) query = query.or(`customer_name.ilike.%${params.q}%,customer_email.ilike.%${params.q}%,phone.ilike.%${params.q}%`);

  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to);
  throwIfError(error);
  return toPaginated(data as unknown as Booking[] | null, count, page, perPage);
}

export async function getBookingById(supabase: SupabaseClient, id: string): Promise<Booking | null> {
  const { data, error } = await supabase.from(TABLE).select(WITH_TOUR_SELECT).eq('id', id).maybeSingle();
  throwIfError(error);
  return (data as unknown as Booking | null) ?? null;
}

// =============================================================================
// Batch 3A-10 — Dashboard aggregation helpers. All active (non-deleted)
// bookings only, matching the default `listBookings()` scope. Each fetches
// only the columns it needs and aggregates in-memory rather than issuing a
// separate `head: true` count query per bucket (status/month/destination/
// tour), keeping this to one round-trip per chart.
// =============================================================================

/**
 * Counts active bookings per `status` — powers the Dashboard's "Total
 * Bookings" + "Booking Pending/Confirmed/Completed/Cancelled" stat cards
 * (the total is simply the sum of all four) and the "Booking Status" chart.
 */
export async function getBookingStatusBreakdown(supabase: SupabaseClient): Promise<Record<BookingStatus, number>> {
  const { data, error } = await supabase.from(TABLE).select('status').is('deleted_at', null);
  throwIfError(error);
  const counts = Object.fromEntries(BOOKING_STATUSES.map((s) => [s, 0])) as Record<BookingStatus, number>;
  for (const row of (data ?? []) as Array<{ status: BookingStatus }>) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
}

/**
 * Active booking counts bucketed by creation month, oldest→newest — powers
 * the Dashboard's "Booking per Bulan" chart. Buckets are pre-seeded with 0
 * so months with no bookings still show up on the chart's x-axis.
 */
export async function getBookingsPerMonth(
  supabase: SupabaseClient,
  months = 6
): Promise<Array<{ month: string; count: number }>> {
  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);
  since.setMonth(since.getMonth() - (months - 1));

  const { data, error } = await supabase.from(TABLE).select('created_at').is('deleted_at', null).gte('created_at', since.toISOString());
  throwIfError(error);

  const buckets: Array<{ key: string; month: string; count: number }> = [];
  const cursor = new Date(since);
  for (let i = 0; i < months; i++) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    const month = new Intl.DateTimeFormat('id-ID', { month: 'short', year: '2-digit' }).format(cursor);
    buckets.push({ key, month, count: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  for (const row of (data ?? []) as Array<{ created_at: string }>) {
    const d = new Date(row.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const bucket = buckets.find((b) => b.key === key);
    if (bucket) bucket.count++;
  }

  return buckets.map(({ month, count }) => ({ month, count }));
}

/**
 * Top destinations ranked by active booking count (via the booked tour's
 * `destination_id`) — powers the Dashboard's "Popular Destination" chart.
 */
export async function getPopularDestinations(
  supabase: SupabaseClient,
  limit = 5
): Promise<Array<{ name: string; count: number }>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('tour:tours!inner(destination:destinations(name))')
    .is('deleted_at', null);
  throwIfError(error);

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as unknown as Array<{ tour: { destination: { name: string } | null } | null }>) {
    const name = row.tour?.destination?.name;
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Top tours ranked by active booking count — powers the Dashboard's
 * "Popular Tour" chart.
 */
export async function getPopularTours(supabase: SupabaseClient, limit = 5): Promise<Array<{ title: string; count: number }>> {
  const { data, error } = await supabase.from(TABLE).select('tour:tours!inner(title)').is('deleted_at', null);
  throwIfError(error);

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as unknown as Array<{ tour: { title: string } | null }>) {
    const title = row.tour?.title;
    if (!title) continue;
    counts.set(title, (counts.get(title) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Public insert — called from `/api/public/booking` (Batch 2). No auth/actor required; RLS allows anonymous insert. */
export async function createBooking(supabase: SupabaseClient, input: BookingInput): Promise<Booking> {
  const { data, error } = await supabase.from(TABLE).insert(input).select('*').single();
  throwIfError(error);

  // Logged with actor=null since this is a public-facing action, not a staff action.
  await logActivity(supabase, {
    actor: null,
    action: 'create',
    entity: 'bookings',
    entityId: data.id,
    description: `Booking baru dari ${data.customer_name}`,
  });
  return data as Booking;
}

/**
 * Staff-only edit of customer-entered details (name/email/phone/participants/
 * travel date) plus notes — for correcting typos or updating info by phone,
 * mirrors `updateTestimonial()`. Status changes go through
 * `updateBookingStatus()` instead, and notes-only edits can use the lighter
 * `updateBookingNotes()`.
 */
export async function updateBooking(
  supabase: SupabaseClient,
  id: string,
  input: BookingAdminUpdateInput,
  actor: UserProfile | null
): Promise<Booking> {
  const { data, error } = await supabase.from(TABLE).update(input).eq('id', id).select(WITH_TOUR_SELECT).single();
  throwIfError(error);

  await logActivity(supabase, {
    actor,
    action: 'update',
    entity: 'bookings',
    entityId: id,
    description: `Memperbarui data booking "${data.customer_name}"`,
  });
  return data as unknown as Booking;
}

/** Staff-only status change (confirm/complete/cancel). */
export async function updateBookingStatus(
  supabase: SupabaseClient,
  id: string,
  status: BookingStatus,
  actor: UserProfile | null
): Promise<Booking> {
  const { data, error } = await supabase.from(TABLE).update({ status }).eq('id', id).select(WITH_TOUR_SELECT).single();
  throwIfError(error);

  await logActivity(supabase, {
    actor,
    action: 'status_change',
    entity: 'bookings',
    entityId: id,
    description: `Mengubah status booking menjadi "${status}"`,
    metadata: { status },
  });
  return data as unknown as Booking;
}

/** Staff-only notes update — a lighter-weight action than the full edit form, used by the quick "Notes" panel on the detail page. */
export async function updateBookingNotes(
  supabase: SupabaseClient,
  id: string,
  notes: string | null,
  actor: UserProfile | null
): Promise<Booking> {
  const { data, error } = await supabase.from(TABLE).update({ notes }).eq('id', id).select(WITH_TOUR_SELECT).single();
  throwIfError(error);

  await logActivity(supabase, {
    actor,
    action: 'update',
    entity: 'bookings',
    entityId: id,
    description: `Memperbarui catatan booking "${data.customer_name}"`,
  });
  return data as unknown as Booking;
}

/** Soft delete (default). Row stays in the DB with `deleted_at` set, hidden from normal admin lists. */
export async function softDeleteBooking(supabase: SupabaseClient, id: string, actor: UserProfile | null): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ deleted_at: new Date().toISOString() }).eq('id', id);
  throwIfError(error);
  await logActivity(supabase, { actor, action: 'soft_delete', entity: 'bookings', entityId: id, description: 'Menghapus (arsip) booking' });
}

/** Restores a soft-deleted booking from `/admin/bookings/trash`. */
export async function restoreBooking(supabase: SupabaseClient, id: string, actor: UserProfile | null): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ deleted_at: null }).eq('id', id);
  throwIfError(error);
  await logActivity(supabase, { actor, action: 'restore', entity: 'bookings', entityId: id, description: 'Memulihkan booking dari arsip' });
}

/** Permanently deletes a booking row. Admin-only — enforced by the calling API route via requireRole(). */
export async function hardDeleteBooking(supabase: SupabaseClient, id: string, actor: UserProfile | null): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  throwIfError(error);
  await logActivity(supabase, { actor, action: 'delete', entity: 'bookings', entityId: id, description: 'Menghapus permanen booking' });
}
