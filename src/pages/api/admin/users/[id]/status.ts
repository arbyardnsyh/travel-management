// =============================================================================
// POST /api/admin/users/[id]/status — quick "Aktifkan/Nonaktifkan" toggle
// (Batch 3A-8). This is the soft-delete substitute for `public.users` (no
// `deleted_at` column on this table — see the module comment in
// `src/services/user.service.ts`): deactivating a staff account blocks their
// NEXT login attempt (`src/lib/auth.ts#loginWithPassword` already checks
// `is_active`, unchanged from an earlier batch), without breaking the
// `created_by` audit trail on content tables, and can be reversed.
// Note: an already-open session for that user stays valid until it expires
// naturally (`getCurrentUser()`/middleware don't re-check `is_active` per
// request) — that's existing Batch 1 auth behavior, out of scope to change
// here. Admin-only, mirroring `./role.ts` and
// `/api/admin/bookings/[id]/status.ts`.
// =============================================================================

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { booleanFromString } from '@/lib/validation/user.schema';
import { parseFormData, parseJsonBody } from '@/utils/parse-form';
import { jsonOk, jsonError, redirectAbsolute } from '@/utils/response';
import { setUserActive } from '@/services';

export const prerender = false;

const statusChangeSchema = z.object({
  is_active: booleanFromString,
});

export const POST: APIRoute = async ({ request, params, locals }) => {
  if (!requireRole(locals.user, ['admin'])) {
    return jsonError('Hanya admin yang dapat mengubah status pengguna.', 403);
  }

  const id = params.id!;
  const contentType = request.headers.get('content-type') || '';
  const wantsJson = contentType.includes('application/json') || (request.headers.get('accept') || '').includes('application/json');

  // Deactivating your own account would lock you out immediately.
  if (locals.user?.id === id) {
    const message = 'Anda tidak dapat menonaktifkan akun Anda sendiri.';
    if (wantsJson) return jsonError(message, 400);
    return redirectAbsolute(request, `/admin/users/${id}?toast=${encodeURIComponent(message)}&toastType=error`, 303);
  }

  const result = contentType.includes('application/json')
    ? parseJsonBody(await request.json(), statusChangeSchema)
    : parseFormData(await request.formData(), statusChangeSchema);

  if (!result.success) {
    if (wantsJson) return jsonError(JSON.stringify(result.fieldErrors), 422);
    return redirectAbsolute(request, `/admin/users/${id}?toast=${encodeURIComponent('Status tidak valid.')}&toastType=error`, 303);
  }

  try {
    const user = await setUserActive(locals.supabase, id, result.data.is_active, locals.user);
    if (wantsJson) return jsonOk(user);
    const label = user.is_active ? 'diaktifkan' : 'dinonaktifkan';
    return redirectAbsolute(request, `/admin/users/${id}?toast=${encodeURIComponent(`Pengguna berhasil ${label}.`)}&toastType=success`, 303);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal mengubah status pengguna.';
    if (wantsJson) return jsonError(message, 500);
    return redirectAbsolute(request, `/admin/users/${id}?toast=${encodeURIComponent(message)}&toastType=error`, 303);
  }
};
