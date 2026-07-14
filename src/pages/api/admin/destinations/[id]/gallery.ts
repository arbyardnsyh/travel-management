// =============================================================================
// /api/admin/destinations/[id]/gallery — add/remove photos in a destination's
// gallery (`destination_gallery` table), per ARCHITECTURE.md §10.
//
// POST adds a photo (image already uploaded via /api/admin/upload, path
// posted here as `image_url`).
// Native <form> can't send DELETE, so photo removal also comes through POST
// with a hidden `_method=DELETE` + `photo_id` field (same spoofing pattern
// as /api/admin/destinations/[id]).
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { jsonError, redirectAbsolute } from '@/utils/response';
import { destinationGalleryItemSchema } from '@/lib/validation/destination.schema';
import { parseFormData } from '@/utils/parse-form';
import { addDestinationGalleryPhoto, deleteDestinationGalleryPhoto } from '@/services';

export const prerender = false;

export const POST: APIRoute = async ({ request, params, locals }) => {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses.', 403);
  }

  const destinationId = params.id!;
  const formData = await request.formData();
  const editUrl = `/admin/destinations/${destinationId}/edit`;

  // Photo removal is spoofed through POST (native forms can't send DELETE).
  if (String(formData.get('_method') ?? '').toUpperCase() === 'DELETE') {
    const photoId = String(formData.get('photo_id') ?? '');
    if (!photoId) {
      return redirectAbsolute(request, `${editUrl}?toast=${encodeURIComponent('photo_id wajib disertakan.')}&toastType=error`, 303);
    }
    try {
      await deleteDestinationGalleryPhoto(locals.supabase, photoId, locals.user);
      return redirectAbsolute(request, `${editUrl}?toast=${encodeURIComponent('Foto galeri dihapus.')}&toastType=success`, 303);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus foto galeri.';
      return redirectAbsolute(request, `${editUrl}?toast=${encodeURIComponent(message)}&toastType=error`, 303);
    }
  }

  formData.set('destination_id', destinationId);
  const result = parseFormData(formData, destinationGalleryItemSchema);
  if (!result.success) {
    return redirectAbsolute(request, `${editUrl}?toast=${encodeURIComponent('Gagal menambahkan foto galeri.')}&toastType=error`, 303);
  }

  try {
    await addDestinationGalleryPhoto(locals.supabase, result.data, locals.user);
    return redirectAbsolute(request, `${editUrl}?toast=${encodeURIComponent('Foto galeri berhasil ditambahkan.')}&toastType=success`, 303);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menambahkan foto galeri.';
    return redirectAbsolute(request, `${editUrl}?toast=${encodeURIComponent(message)}&toastType=error`, 303);
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses.', 403);
  }

  const url = new URL(request.url);
  const photoId = url.searchParams.get('photo_id');
  if (!photoId) return jsonError('photo_id wajib disertakan.', 400);

  try {
    await deleteDestinationGalleryPhoto(locals.supabase, photoId, locals.user);
    return new Response(JSON.stringify({ success: true, data: { deleted: true } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Gagal menghapus foto galeri.', 500);
  }
};
