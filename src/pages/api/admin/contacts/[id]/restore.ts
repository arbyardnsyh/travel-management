// =============================================================================
// POST /api/admin/contacts/[id]/restore — restore a soft-deleted contact
// message from the trash view (`/admin/contacts/trash`). Mirrors
// /api/admin/testimonials/[id]/restore.ts.
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { jsonOk, jsonError, redirectAbsolute } from '@/utils/response';
import { restoreContact } from '@/services';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, locals }) => {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses.', 403);
  }

  const id = params.id!;
  const wantsJson = (request.headers.get('accept') || '').includes('application/json');

  try {
    await restoreContact(locals.supabase, id, locals.user);
    if (wantsJson) return jsonOk({ restored: true });
    return redirectAbsolute(request, `/admin/contacts/trash?toast=${encodeURIComponent('Pesan berhasil dipulihkan.')}&toastType=success`, 303);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memulihkan pesan kontak.';
    if (wantsJson) return jsonError(message, 500);
    return redirectAbsolute(request, `/admin/contacts/trash?toast=${encodeURIComponent(message)}&toastType=error`, 303);
  }
};
