// =============================================================================
// /api/admin/profile — update the signed-in staff member's own profile
// (name, avatar_url) (Batch 3A-8). Any staff role (admin/editor) may call
// this for their OWN row only — `updateUser()` is called with
// `locals.supabase` (the caller's own session, not the service role), so
// `users_update_self` RLS (0002_rls_policies.sql) is the authority here,
// same defense-in-depth pattern as every other module
// (ARCHITECTURE.md §10: "Gunakan Astro.locals.supabase ... supaya RLS tetap
// jadi lapisan pertahanan kedua").
//
// Deliberately does NOT accept `role` or `is_active` — those fields aren't
// even in `profileUpdateSchema`, and the RLS policy wouldn't allow a
// non-admin to change them anyway (`users_admin_all` is the only policy
// that permits touching other users' rows / privileged columns).
//
// Native HTML forms only submit GET/POST, so the edit form POSTs here with a
// hidden `_method=PUT` field, mirroring every other admin module.
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { profileUpdateSchema } from '@/lib/validation/user.schema';
import { parseFormData, parseJsonBody } from '@/utils/parse-form';
import { jsonOk, jsonError, redirectAbsolute } from '@/utils/response';
import { updateUser } from '@/services';

export const prerender = false;

async function handleUpdate(request: Request, locals: App.Locals) {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses.', 403);
  }

  const contentType = request.headers.get('content-type') || '';
  const result = contentType.includes('application/json')
    ? parseJsonBody(await request.json(), profileUpdateSchema.partial())
    : parseFormData(await request.formData(), profileUpdateSchema);

  if (!result.success) {
    if (contentType.includes('application/json')) {
      return jsonError(JSON.stringify(result.fieldErrors), 422);
    }
    const params = new URLSearchParams({ toast: 'Periksa kembali data yang diisi.', toastType: 'error', tab: 'edit' });
    for (const [key, message] of Object.entries(result.fieldErrors)) {
      params.set(`error_${key}`, message);
    }
    return redirectAbsolute(request, `/admin/profile?${params.toString()}`, 303);
  }

  try {
    const user = await updateUser(locals.supabase, locals.user!.id, result.data, locals.user);
    if (contentType.includes('application/json')) return jsonOk(user);
    return redirectAbsolute(request, `/admin/profile?toast=${encodeURIComponent('Profil berhasil diperbarui.')}&toastType=success&tab=edit`, 303);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memperbarui profil.';
    if (contentType.includes('application/json')) return jsonError(message, 500);
    return redirectAbsolute(request, `/admin/profile?toast=${encodeURIComponent(message)}&toastType=error&tab=edit`, 303);
  }
}

export const POST: APIRoute = async ({ request, locals }) => handleUpdate(request, locals);
export const PUT: APIRoute = async ({ request, locals }) => handleUpdate(request, locals);
