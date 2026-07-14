// =============================================================================
// POST /api/admin/testimonials/[id]/unapprove — moderation action: revert an
// approved testimonial back to `pending`, removing it from the public
// `/testimonials` page without deleting it.
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { jsonOk, jsonError, redirectAbsolute } from '@/utils/response';
import { unapproveTestimonial } from '@/services';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, locals }) => {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses.', 403);
  }

  const id = params.id!;
  const wantsJson = (request.headers.get('accept') || '').includes('application/json');

  try {
    const testimonial = await unapproveTestimonial(locals.supabase, id, locals.user);
    if (wantsJson) return jsonOk(testimonial);
    return redirectAbsolute(request, 
      `/admin/testimonials?toast=${encodeURIComponent(`Testimoni "${testimonial.name}" dibatalkan persetujuannya.`)}&toastType=success`,
      303
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal membatalkan persetujuan testimoni.';
    if (wantsJson) return jsonError(message, 500);
    return redirectAbsolute(request, `/admin/testimonials?toast=${encodeURIComponent(message)}&toastType=error`, 303);
  }
};
