// =============================================================================
// POST /api/admin/users/[id]/role — quick "Ubah Role" action (Batch 3A-8).
// Kept as its own single-purpose route, mirroring
// /api/admin/bookings/[id]/status.ts, so the role buttons on the user
// detail page stay a single click. Admin-only per the master prompt
// ("Editor: Tidak boleh mengubah role user").
// =============================================================================

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { USER_ROLES } from '@/lib/constants';
import { parseFormData, parseJsonBody } from '@/utils/parse-form';
import { jsonOk, jsonError, redirectAbsolute } from '@/utils/response';
import { changeUserRole } from '@/services';

export const prerender = false;

const roleChangeSchema = z.object({
  role: z.enum(USER_ROLES, { errorMap: () => ({ message: `Role harus salah satu dari: ${USER_ROLES.join(', ')}.` }) }),
});

export const POST: APIRoute = async ({ request, params, locals }) => {
  if (!requireRole(locals.user, ['admin'])) {
    return jsonError('Hanya admin yang dapat mengubah role pengguna.', 403);
  }

  const id = params.id!;
  const contentType = request.headers.get('content-type') || '';
  const wantsJson = contentType.includes('application/json') || (request.headers.get('accept') || '').includes('application/json');

  // An admin can't demote themselves — would immediately lock them out of
  // /admin/users (and every other admin-only area) with no other admin
  // necessarily available to undo it.
  if (locals.user?.id === id) {
    const message = 'Anda tidak dapat mengubah role akun Anda sendiri.';
    if (wantsJson) return jsonError(message, 400);
    return redirectAbsolute(request, `/admin/users/${id}?toast=${encodeURIComponent(message)}&toastType=error`, 303);
  }

  const result = contentType.includes('application/json')
    ? parseJsonBody(await request.json(), roleChangeSchema)
    : parseFormData(await request.formData(), roleChangeSchema);

  if (!result.success) {
    if (wantsJson) return jsonError(JSON.stringify(result.fieldErrors), 422);
    return redirectAbsolute(request, `/admin/users/${id}?toast=${encodeURIComponent('Role tidak valid.')}&toastType=error`, 303);
  }

  try {
    const user = await changeUserRole(locals.supabase, id, result.data.role, locals.user);
    if (wantsJson) return jsonOk(user);
    return redirectAbsolute(request, 
      `/admin/users/${id}?toast=${encodeURIComponent(`Role pengguna diubah menjadi "${user.role}".`)}&toastType=success`,
      303
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal mengubah role pengguna.';
    if (wantsJson) return jsonError(message, 500);
    return redirectAbsolute(request, `/admin/users/${id}?toast=${encodeURIComponent(message)}&toastType=error`, 303);
  }
};
