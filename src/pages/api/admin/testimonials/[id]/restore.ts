// =============================================================================
// POST /api/admin/testimonials/[id]/restore — restore a soft-deleted
// testimonial from the trash view (`/admin/testimonials/trash`). Mirrors
// /api/admin/gallery/[id]/restore.ts.
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { jsonOk, jsonError, redirectAbsolute } from '@/utils/response';
import { restoreTestimonial } from '@/services';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, locals }) => {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses.', 403);
  }

  const id = params.id!;
  const wantsJson = (request.headers.get('accept') || '').includes('application/json');

  try {
    await restoreTestimonial(locals.supabase, id, locals.user);
    if (wantsJson) return jsonOk({ restored: true });
    return redirectAbsolute(request, `/admin/testimonials/trash?toast=${encodeURIComponent('Testimoni berhasil dipulihkan.')}&toastType=success`, 303);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memulihkan testimoni.';
    if (wantsJson) return jsonError(message, 500);
    return redirectAbsolute(request, `/admin/testimonials/trash?toast=${encodeURIComponent(message)}&toastType=error`, 303);
  }
};
