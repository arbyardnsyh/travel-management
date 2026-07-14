// =============================================================================
// /api/admin/blogs/[id] — update + delete a single blog article.
//
// Native HTML forms can only submit GET/POST, so:
//   - The edit form POSTs here with a hidden `_method=PUT` field.
//   - ConfirmDeleteModal's form POSTs here with a hidden `_method=DELETE` field.
// True PUT/DELETE handlers are also exported for programmatic/fetch callers,
// sharing the same logic (ARCHITECTURE.md §9/§10). Mirrors
// /api/admin/destinations/[id].ts.
//
// Permanent delete (`?permanent=1`) is admin-only per the master prompt
// ("Editor tidak boleh: Permanent Delete").
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { blogSchema } from '@/lib/validation/blog.schema';
import { parseFormData, parseJsonBody } from '@/utils/parse-form';
import { jsonOk, jsonError, redirectAbsolute } from '@/utils/response';
import { updateBlog, softDeleteBlog, hardDeleteBlog } from '@/services';

export const prerender = false;

async function handleUpdate(request: Request, id: string, locals: App.Locals) {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses.', 403);
  }

  const contentType = request.headers.get('content-type') || '';
  const result = contentType.includes('application/json')
    ? parseJsonBody(await request.json(), blogSchema.partial())
    : parseFormData(await request.formData(), blogSchema);

  if (!result.success) {
    if (contentType.includes('application/json')) {
      return jsonError(JSON.stringify(result.fieldErrors), 422);
    }
    const params = new URLSearchParams({ toast: 'Periksa kembali data yang diisi.', toastType: 'error' });
    return redirectAbsolute(request, `/admin/blogs/${id}/edit?${params.toString()}`, 303);
  }

  try {
    const blog = await updateBlog(locals.supabase, id, result.data as Parameters<typeof updateBlog>[2], locals.user);
    if (contentType.includes('application/json')) return jsonOk(blog);
    return redirectAbsolute(request, 
      `/admin/blogs?toast=${encodeURIComponent(`Artikel "${blog.title}" berhasil diperbarui.`)}&toastType=success`,
      303
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memperbarui artikel.';
    if (contentType.includes('application/json')) return jsonError(message, 500);
    return redirectAbsolute(request, `/admin/blogs/${id}/edit?toast=${encodeURIComponent(message)}&toastType=error`, 303);
  }
}

async function handleSoftDelete(request: Request, id: string, locals: App.Locals, wantsJson: boolean) {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses.', 403);
  }
  try {
    await softDeleteBlog(locals.supabase, id, locals.user);
    if (wantsJson) return jsonOk({ deleted: true });
    return redirectAbsolute(request, `/admin/blogs?toast=${encodeURIComponent('Artikel dipindahkan ke arsip.')}&toastType=success`, 303);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menghapus artikel.';
    if (wantsJson) return jsonError(message, 500);
    return redirectAbsolute(request, `/admin/blogs?toast=${encodeURIComponent(message)}&toastType=error`, 303);
  }
}

async function handlePermanentDelete(request: Request, id: string, locals: App.Locals, wantsJson: boolean) {
  if (!requireRole(locals.user, ['admin'])) {
    return jsonError('Hanya admin yang dapat menghapus permanen.', 403);
  }
  try {
    await hardDeleteBlog(locals.supabase, id, locals.user);
    if (wantsJson) return jsonOk({ deleted: true, permanent: true });
    return redirectAbsolute(request, `/admin/blogs/trash?toast=${encodeURIComponent('Artikel dihapus permanen.')}&toastType=success`, 303);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menghapus permanen artikel.';
    if (wantsJson) return jsonError(message, 500);
    return redirectAbsolute(request, `/admin/blogs/trash?toast=${encodeURIComponent(message)}&toastType=error`, 303);
  }
}

export const POST: APIRoute = async ({ request, params, locals }) => {
  const id = params.id!;
  const clone = request.clone();
  const contentType = request.headers.get('content-type') || '';
  let method = 'PUT';
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const fd = await clone.formData();
    method = String(fd.get('_method') ?? 'PUT').toUpperCase();
  }

  if (method === 'DELETE') {
    const url = new URL(request.url);
    const permanent = url.searchParams.get('permanent') === '1';
    return permanent ? handlePermanentDelete(request, id, locals, false) : handleSoftDelete(request, id, locals, false);
  }
  return handleUpdate(request, id, locals);
};

export const PUT: APIRoute = async ({ request, params, locals }) => handleUpdate(request, params.id!, locals);

export const DELETE: APIRoute = async ({ request, params, locals }) => {
  const url = new URL(request.url);
  const permanent = url.searchParams.get('permanent') === '1';
  const wantsJson = (request.headers.get('accept') || '').includes('application/json');
  return permanent
    ? handlePermanentDelete(request, params.id!, locals, wantsJson)
    : handleSoftDelete(request, params.id!, locals, wantsJson);
};
