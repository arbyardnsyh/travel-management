// =============================================================================
// POST /api/admin/tours — create a tour.
// Plain native `<form method="post">` submit from /admin/tours/create
// (ARCHITECTURE.md §9): validate → insert → redirect with ?toast=...
// Mirrors /api/admin/destinations/index.ts.
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { tourSchema } from '@/lib/validation/tour.schema';
import { parseFormData } from '@/utils/parse-form';
import { jsonError } from '@/utils/response';
import { createTour } from '@/services';

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses.', 403);
  }

  const formData = await request.formData();
  const result = parseFormData(formData, tourSchema);

  if (!result.success) {
    const params = new URLSearchParams();
    params.set('toast', 'Periksa kembali data yang diisi.');
    params.set('toastType', 'error');
    for (const [key, message] of Object.entries(result.fieldErrors)) {
      params.set(`error_${key}`, message);
    }
    // Re-render the form with errors instead of losing the user's input.
    return redirect(`/admin/tours/create?${params.toString()}`);
  }

  try {
    const tour = await createTour(locals.supabase, result.data as Parameters<typeof createTour>[1], locals.user);
    return redirect(`/admin/tours?toast=${encodeURIComponent(`Tour "${tour.title}" berhasil ditambahkan.`)}&toastType=success`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menyimpan tour.';
    return redirect(`/admin/tours/create?toast=${encodeURIComponent(message)}&toastType=error`);
  }
};
