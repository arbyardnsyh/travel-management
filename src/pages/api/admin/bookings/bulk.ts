// =============================================================================
// POST /api/admin/bookings/bulk — apply one action to several selected
// bookings at once from the `/admin/bookings` list (checkboxes + "Aksi
// Massal" toolbar). Added for the master prompt's "Bulk Action (jika
// memungkinkan tanpa mengubah arsitektur)" requirement — implemented as a
// thin wrapper that loops the existing single-row service functions
// (updateBookingStatus / softDeleteBooking), so it reuses the same
// validation, RLS, and activity-logging path as every other action instead
// of introducing new architecture. JSON-only endpoint (called via fetch from
// a small inline script — no new component/framework).
//
// Permanent delete is intentionally NOT offered in bulk — it stays a
// deliberate, one-at-a-time, admin-only action from the trash view.
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { bookingBulkActionSchema } from '@/lib/validation/booking.schema';
import { jsonOk, jsonError } from '@/utils/response';
import { updateBookingStatus, softDeleteBooking } from '@/services';
import type { BookingStatus } from '@/lib/database.types';

export const prerender = false;

const STATUS_ACTIONS: BookingStatus[] = ['pending', 'confirmed', 'completed', 'cancelled'];

export const POST: APIRoute = async ({ request, locals }) => {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses.', 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Body request tidak valid.', 400);
  }

  const result = bookingBulkActionSchema.safeParse(body);
  if (!result.success) {
    return jsonError(result.error.issues.map((i) => i.message).join(' '), 422);
  }

  const { ids, action } = result.data;
  let succeeded = 0;
  const failed: string[] = [];

  for (const id of ids) {
    try {
      if (action === 'soft_delete') {
        await softDeleteBooking(locals.supabase, id, locals.user);
      } else if (STATUS_ACTIONS.includes(action as BookingStatus)) {
        await updateBookingStatus(locals.supabase, id, action as BookingStatus, locals.user);
      }
      succeeded++;
    } catch {
      failed.push(id);
    }
  }

  return jsonOk({ succeeded, failed, total: ids.length });
};
