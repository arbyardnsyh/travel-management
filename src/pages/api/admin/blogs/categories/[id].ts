// =============================================================================
// /api/admin/blogs/categories/[id] — update + delete a single blog category.
//
// Native HTML forms can only submit GET/POST, so:
//   - The edit form POSTs here with a hidden `_method=PUT` field.
//   - ConfirmDeleteModal's form POSTs here with a hidden `_method=DELETE` field.
// True PUT/DELETE handlers are also exported for programmatic/fetch callers,
// sharing the same logic (ARCHITECTURE.md §9/§10). Mirrors
// /api/admin/faq/[id].ts.
//
// There is no soft-delete tier for blog_categories (see
// blog-category.service.ts header) — delete here is always permanent, and
// per the master prompt ("Editor tidak boleh: Permanent Delete") it is
// restricted to `admin` only, same as every other module's hard-delete step.
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { blogCategorySchema } from '@/lib/validation/blog.schema';
import { parseFormData, parseJsonBody } from '@/utils/parse-form';
import { jsonOk, jsonError, redirectAbsolute } from '@/utils/response';
import { updateBlogCategory, hardDeleteBlogCategory } from '@/services';

export const prerender = false;

async function handleUpdate(request: Request, id: string, locals: App.Locals) {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses.', 403);
  }

  const contentType = request.headers.get('content-type') || '';
  const result = contentType.includes('application/json')
    ? parseJsonBody(await request.json(), blogCategorySchema.partial())
    : parseFormData(await request.formData(), blogCategorySchema);

  if (!result.success) {
    if (contentType.includes('application/json')) {
      return jsonError(JSON.stringify(result.fieldErrors), 422);
    }
    const params = new URLSearchParams({ toast: 'Periksa kembali data yang diisi.', toastType: 'error' });
    return redirectAbsolute(request, `/admin/blogs/categories/${id}/edit?${params.toString()}`, 303);
  }

  try {
    const category = await updateBlogCategory(locals.supabase, id, result.data, locals.user);
    if (contentType.includes('application/json')) return jsonOk(category);
    return redirectAbsolute(request, 
      `/admin/blogs/categories?toast=${encodeURIComponent(`Kategori "${category.name}" berhasil diperbarui.`)}&toastType=success`,
      303
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memperbarui kategori.';
    if (contentType.includes('application/json')) return jsonError(message, 500);
    return redirectAbsolute(request, `/admin/blogs/categories/${id}/edit?toast=${encodeURIComponent(message)}&toastType=error`, 303);
  }
}

async function handleDelete(request: Request, id: string, locals: App.Locals, wantsJson: boolean) {
  if (!requireRole(locals.user, ['admin'])) {
    return jsonError('Hanya admin yang dapat menghapus kategori.', 403);
  }
  try {
    await hardDeleteBlogCategory(locals.supabase, id, locals.user);
    if (wantsJson) return jsonOk({ deleted: true, permanent: true });
    return redirectAbsolute(request, 
      `/admin/blogs/categories?toast=${encodeURIComponent('Kategori berhasil dihapus.')}&toastType=success`,
      303
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menghapus kategori.';
    if (wantsJson) return jsonError(message, 500);
    return redirectAbsolute(request, `/admin/blogs/categories?toast=${encodeURIComponent(message)}&toastType=error`, 303);
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

  if (method === 'DELETE') return handleDelete(request, id, locals, false);
  return handleUpdate(request, id, locals);
};

export const PUT: APIRoute = async ({ request, params, locals }) => handleUpdate(request, params.id!, locals);

export const DELETE: APIRoute = async ({ request, params, locals }) => {
  const wantsJson = (request.headers.get('accept') || '').includes('application/json');
  return handleDelete(request, params.id!, locals, wantsJson);
};
