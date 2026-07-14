// =============================================================================
// POST /api/admin/testimonials/[id]/approve — moderation action: publish a
// pending testimonial to the public `/testimonials` page.
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { jsonOk, jsonError, redirectAbsolute } from '@/utils/response';
import { approveTestimonial } from '@/services';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, locals }) => {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses.', 403);
  }

  const id = params.id!;
  const wantsJson = (request.headers.get('accept') || '').includes('application/json');

  try {
    const testimonial = await approveTestimonial(locals.supabase, id, locals.user);
    if (wantsJson) return jsonOk(testimonial);
    return redirectAbsolute(request, 
      `/admin/testimonials?toast=${encodeURIComponent(`Testimoni "${testimonial.name}" disetujui.`)}&toastType=success`,
      303
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menyetujui testimoni.';
    if (wantsJson) return jsonError(message, 500);
    return redirectAbsolute(request, `/admin/testimonials?toast=${encodeURIComponent(message)}&toastType=error`, 303);
  }
};
