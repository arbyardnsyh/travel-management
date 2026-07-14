// =============================================================================
// POST /api/admin/profile/password — self-service "Ganti Password"
// (Batch 3A-8, new route — no equivalent existed before this batch). Any
// staff role (admin/editor) may change their OWN password, via Supabase
// Auth (`supabase.auth.updateUser()`), never touching `public.users`.
// See `user.service.ts#changeOwnPassword` for the current-password
// re-verification step.
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { profilePasswordSchema } from '@/lib/validation/user.schema';
import { parseFormData, parseJsonBody } from '@/utils/parse-form';
import { jsonOk, jsonError, redirectAbsolute } from '@/utils/response';
import { changeOwnPassword } from '@/services';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses.', 403);
  }

  const contentType = request.headers.get('content-type') || '';
  const wantsJson = contentType.includes('application/json') || (request.headers.get('accept') || '').includes('application/json');

  const result = contentType.includes('application/json')
    ? parseJsonBody(await request.json(), profilePasswordSchema)
    : parseFormData(await request.formData(), profilePasswordSchema);

  if (!result.success) {
    if (wantsJson) return jsonError(JSON.stringify(result.fieldErrors), 422);
    const params = new URLSearchParams({ toast: Object.values(result.fieldErrors)[0] ?? 'Periksa kembali data yang diisi.', toastType: 'error', tab: 'password' });
    for (const [key, message] of Object.entries(result.fieldErrors)) {
      params.set(`error_${key}`, message);
    }
    return redirectAbsolute(request, `/admin/profile?${params.toString()}`, 303);
  }

  try {
    await changeOwnPassword(locals.supabase, locals.user!, result.data.current_password, result.data.new_password);
    if (wantsJson) return jsonOk({ updated: true });
    return redirectAbsolute(request, `/admin/profile?toast=${encodeURIComponent('Password berhasil diubah.')}&toastType=success&tab=password`, 303);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal mengubah password.';
    if (wantsJson) return jsonError(message, 500);
    return redirectAbsolute(request, `/admin/profile?toast=${encodeURIComponent(message)}&toastType=error&tab=password`, 303);
  }
};
