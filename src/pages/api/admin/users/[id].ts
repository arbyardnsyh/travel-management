// =============================================================================
// /api/admin/users/[id] — update a user's basic info + permanently delete a
// user (Batch 3A-8). Admin-only throughout, per the master prompt (Editor
// "Tidak boleh mengubah role user", "Tidak boleh menghapus permanen user").
//
// Role changes and active/inactive toggles are intentionally NOT handled
// here — they live in their own single-purpose routes
// (`./[id]/role.ts`, `./[id]/status.ts`) mirroring the booking-status
// pattern (`/api/admin/bookings/[id]/status.ts`), so the "Ubah Role" and
// "Nonaktifkan/Aktifkan" quick actions on the list/detail pages stay a
// single click without resubmitting the whole edit form.
//
// Native HTML forms can only submit GET/POST, so the edit form POSTs here
// with a hidden `_method=PUT` field, and ConfirmDeleteModal's form POSTs
// here with a hidden `_method=DELETE` field — same convention as every
// other admin module (e.g. /api/admin/blogs/[id].ts).
//
// There is no soft delete for `public.users` (no `deleted_at` column — see
// the module comment at the top of `src/services/user.service.ts`), so the
// only delete this route performs is the permanent one.
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { userUpdateSchema } from '@/lib/validation/user.schema';
import { parseFormData, parseJsonBody } from '@/utils/parse-form';
import { jsonOk, jsonError, redirectAbsolute } from '@/utils/response';
import { updateUser, deleteUser } from '@/services';

export const prerender = false;

async function handleUpdate(request: Request, id: string, locals: App.Locals) {
  if (!requireRole(locals.user, ['admin'])) {
    return jsonError('Hanya admin yang dapat mengubah pengguna.', 403);
  }

  const contentType = request.headers.get('content-type') || '';
  const result = contentType.includes('application/json')
    ? parseJsonBody(await request.json(), userUpdateSchema.partial())
    : parseFormData(await request.formData(), userUpdateSchema);

  if (!result.success) {
    if (contentType.includes('application/json')) {
      return jsonError(JSON.stringify(result.fieldErrors), 422);
    }
    const params = new URLSearchParams({ toast: 'Periksa kembali data yang diisi.', toastType: 'error' });
    return redirectAbsolute(request, `/admin/users/${id}/edit?${params.toString()}`, 303);
  }

  // A demoted/deactivated own account would lock the admin out immediately
  // — the edit form for "self" doesn't render role/active controls, but
  // guard the API too in case of a direct/forged request.
  const isSelf = locals.user?.id === id;
  const payload = { ...result.data } as Parameters<typeof updateUser>[2];
  if (isSelf) {
    delete (payload as Record<string, unknown>).role;
    delete (payload as Record<string, unknown>).is_active;
  }

  try {
    const user = await updateUser(locals.supabase, id, payload, locals.user);
    if (contentType.includes('application/json')) return jsonOk(user);
    return redirectAbsolute(request, 
      `/admin/users/${id}?toast=${encodeURIComponent(`Pengguna "${user.name}" berhasil diperbarui.`)}&toastType=success`,
      303
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memperbarui pengguna.';
    if (contentType.includes('application/json')) return jsonError(message, 500);
    return redirectAbsolute(request, `/admin/users/${id}/edit?toast=${encodeURIComponent(message)}&toastType=error`, 303);
  }
}

async function handlePermanentDelete(request: Request, id: string, locals: App.Locals, wantsJson: boolean) {
  if (!requireRole(locals.user, ['admin'])) {
    return jsonError('Hanya admin yang dapat menghapus pengguna.', 403);
  }
  if (locals.user?.id === id) {
    const message = 'Anda tidak dapat menghapus akun Anda sendiri.';
    if (wantsJson) return jsonError(message, 400);
    return redirectAbsolute(request, `/admin/users?toast=${encodeURIComponent(message)}&toastType=error`, 303);
  }

  try {
    await deleteUser(id, locals.user);
    if (wantsJson) return jsonOk({ deleted: true, permanent: true });
    return redirectAbsolute(request, `/admin/users?toast=${encodeURIComponent('Pengguna dihapus permanen.')}&toastType=success`, 303);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menghapus pengguna.';
    if (wantsJson) return jsonError(message, 500);
    return redirectAbsolute(request, `/admin/users?toast=${encodeURIComponent(message)}&toastType=error`, 303);
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
    return handlePermanentDelete(request, id, locals, false);
  }
  return handleUpdate(request, id, locals);
};

export const PUT: APIRoute = async ({ request, params, locals }) => handleUpdate(request, params.id!, locals);

export const DELETE: APIRoute = async ({ request, params, locals }) => {
  const wantsJson = (request.headers.get('accept') || '').includes('application/json');
  return handlePermanentDelete(request, params.id!, locals, wantsJson);
};
