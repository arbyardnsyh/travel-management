// =============================================================================
// POST /api/admin/bookings/[id]/status — staff-only booking status change
// (pending/confirmed/completed/cancelled). Kept as its own action (rather
// than folded into the general edit form) so the "Ubah Status" quick control
// on the list/detail pages stays a single click, mirroring the
// approve/unapprove pattern in /api/admin/testimonials/[id]/approve.ts.
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { bookingStatusUpdateSchema } from '@/lib/validation/booking.schema';
import { parseFormData, parseJsonBody } from '@/utils/parse-form';
import { jsonOk, jsonError, redirectAbsolute } from '@/utils/response';
import { updateBookingStatus } from '@/services';

export const prerender = false;

export const POST: APIRoute = async ({ request, params, locals }) => {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses.', 403);
  }

  const id = params.id!;
  const contentType = request.headers.get('content-type') || '';
  const wantsJson = contentType.includes('application/json') || (request.headers.get('accept') || '').includes('application/json');

  const result = contentType.includes('application/json')
    ? parseJsonBody(await request.json(), bookingStatusUpdateSchema)
    : parseFormData(await request.formData(), bookingStatusUpdateSchema);

  if (!result.success) {
    if (wantsJson) return jsonError(JSON.stringify(result.fieldErrors), 422);
    return redirectAbsolute(request, `/admin/bookings/${id}?toast=${encodeURIComponent('Status tidak valid.')}&toastType=error`, 303);
  }

  try {
    const booking = await updateBookingStatus(locals.supabase, id, result.data.status as Parameters<typeof updateBookingStatus>[2], locals.user);
    if (wantsJson) return jsonOk(booking);
    return redirectAbsolute(request, 
      `/admin/bookings/${id}?toast=${encodeURIComponent(`Status booking diubah menjadi "${booking.status}".`)}&toastType=success`,
      303
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal mengubah status booking.';
    if (wantsJson) return jsonError(message, 500);
    return redirectAbsolute(request, `/admin/bookings/${id}?toast=${encodeURIComponent(message)}&toastType=error`, 303);
  }
};
