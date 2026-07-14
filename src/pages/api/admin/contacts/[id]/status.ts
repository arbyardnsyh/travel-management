// =============================================================================
// POST /api/admin/contacts/[id]/status — staff-only read/unread toggle.
// Kept as its own action (rather than folded into a general edit form,
// which contacts don't have) so the "Tandai Dibaca" / "Tandai Belum Dibaca"
// quick controls on the list/detail pages stay a single click, mirroring
// /api/admin/bookings/[id]/status.ts and the approve/unapprove pattern in
// /api/admin/testimonials/[id]/approve.ts.
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { jsonOk, jsonError, redirectAbsolute } from '@/utils/response';
import { markContactRead, markContactUnread } from '@/services';

export const prerender = false;

export const POST: APIRoute = async ({ request, params, locals }) => {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses.', 403);
  }

  const id = params.id!;
  const contentType = request.headers.get('content-type') || '';
  const wantsJson = contentType.includes('application/json') || (request.headers.get('accept') || '').includes('application/json');

  let status = '';
  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => ({}));
    status = String((body as { status?: string }).status ?? '');
  } else {
    const formData = await request.formData();
    status = String(formData.get('status') ?? '');
  }

  if (status !== 'read' && status !== 'unread') {
    const message = 'Status tidak valid.';
    if (wantsJson) return jsonError(message, 422);
    return redirectAbsolute(request, `/admin/contacts/${id}?toast=${encodeURIComponent(message)}&toastType=error`, 303);
  }

  try {
    const contact = status === 'read'
      ? await markContactRead(locals.supabase, id, locals.user)
      : await markContactUnread(locals.supabase, id, locals.user);

    if (wantsJson) return jsonOk(contact);
    const label = status === 'read' ? 'dibaca' : 'belum dibaca';
    return redirectAbsolute(request, `/admin/contacts?toast=${encodeURIComponent(`Pesan "${contact.name}" ditandai ${label}.`)}&toastType=success`, 303);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal mengubah status pesan.';
    if (wantsJson) return jsonError(message, 500);
    return redirectAbsolute(request, `/admin/contacts/${id}?toast=${encodeURIComponent(message)}&toastType=error`, 303);
  }
};
