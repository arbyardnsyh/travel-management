// =============================================================================
// POST /api/admin/gallery — create a gallery item.
// Plain native `<form method="post">` submit from /admin/gallery/create
// (ARCHITECTURE.md §9): validate → insert → redirect with ?toast=...
// Mirrors /api/admin/tours/index.ts.
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { galleryItemSchema } from '@/lib/validation/gallery.schema';
import { parseFormData } from '@/utils/parse-form';
import { jsonError } from '@/utils/response';
import { createGalleryItem } from '@/services';

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses.', 403);
  }

  const formData = await request.formData();
  const result = parseFormData(formData, galleryItemSchema);

  if (!result.success) {
    const params = new URLSearchParams();
    params.set('toast', 'Periksa kembali data yang diisi.');
    params.set('toastType', 'error');
    for (const [key, message] of Object.entries(result.fieldErrors)) {
      params.set(`error_${key}`, message);
    }
    // Re-render the form with errors instead of losing the user's input.
    return redirect(`/admin/gallery/create?${params.toString()}`);
  }

  try {
    const item = await createGalleryItem(locals.supabase, result.data as Parameters<typeof createGalleryItem>[1], locals.user);
    return redirect(`/admin/gallery?toast=${encodeURIComponent(`Foto "${item.title}" berhasil ditambahkan.`)}&toastType=success`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menyimpan foto galeri.';
    return redirect(`/admin/gallery/create?toast=${encodeURIComponent(message)}&toastType=error`);
  }
};
