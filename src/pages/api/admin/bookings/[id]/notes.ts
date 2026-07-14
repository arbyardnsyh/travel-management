// =============================================================================
// POST /api/admin/bookings/[id]/notes — staff-only internal notes update.
// A lighter-weight sibling of the full edit form, for quickly jotting down a
// note (e.g. "customer called to reschedule") without touching customer data.
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { bookingNotesUpdateSchema } from '@/lib/validation/booking.schema';
import { parseFormData, parseJsonBody } from '@/utils/parse-form';
import { jsonOk, jsonError, redirectAbsolute } from '@/utils/response';
import { updateBookingNotes } from '@/services';

export const prerender = false;

export const POST: APIRoute = async ({ request, params, locals }) => {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses.', 403);
  }

  const id = params.id!;
  const contentType = request.headers.get('content-type') || '';
  const wantsJson = contentType.includes('application/json') || (request.headers.get('accept') || '').includes('application/json');

  const result = contentType.includes('application/json')
    ? parseJsonBody(await request.json(), bookingNotesUpdateSchema)
    : parseFormData(await request.formData(), bookingNotesUpdateSchema);

  if (!result.success) {
    if (wantsJson) return jsonError(JSON.stringify(result.fieldErrors), 422);
    return redirectAbsolute(request, `/admin/bookings/${id}?toast=${encodeURIComponent('Catatan tidak valid.')}&toastType=error`, 303);
  }

  try {
    const booking = await updateBookingNotes(locals.supabase, id, result.data.notes, locals.user);
    if (wantsJson) return jsonOk(booking);
    return redirectAbsolute(request, `/admin/bookings/${id}?toast=${encodeURIComponent('Catatan booking berhasil disimpan.')}&toastType=success`, 303);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menyimpan catatan booking.';
    if (wantsJson) return jsonError(message, 500);
    return redirectAbsolute(request, `/admin/bookings/${id}?toast=${encodeURIComponent(message)}&toastType=error`, 303);
  }
};
