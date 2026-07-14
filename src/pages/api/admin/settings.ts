// =============================================================================
// /api/admin/settings — update the single `settings` row (Batch 3A-7).
//
// Admin-only: `settings_admin_update` in 0002_rls_policies.sql (Batch 2,
// untouched here) already restricts writes to `public.is_admin()` — editors
// cannot write this table no matter what the API allows, so `requireRole`
// mirrors that existing restriction here too instead of letting an editor's
// request reach Supabase only to fail with an opaque RLS error.
//
// Native HTML forms only submit GET/POST, so the edit form POSTs here with a
// hidden `_method=PUT` field, mirroring every other admin module (e.g.
// /api/admin/blogs/[id].ts).
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { settingsSchema } from '@/lib/validation/settings.schema';
import { parseFormData, parseJsonBody } from '@/utils/parse-form';
import { jsonOk, jsonError, redirectAbsolute } from '@/utils/response';
import { updateSettings } from '@/services';

export const prerender = false;

async function handleUpdate(request: Request, locals: App.Locals) {
  if (!requireRole(locals.user, ['admin'])) {
    return jsonError('Hanya admin yang dapat mengubah Pengaturan Situs.', 403);
  }

  const contentType = request.headers.get('content-type') || '';
  const result = contentType.includes('application/json')
    ? parseJsonBody(await request.json(), settingsSchema.partial())
    : parseFormData(await request.formData(), settingsSchema);

  if (!result.success) {
    if (contentType.includes('application/json')) {
      return jsonError(JSON.stringify(result.fieldErrors), 422);
    }
    const params = new URLSearchParams({ toast: 'Periksa kembali data yang diisi.', toastType: 'error' });
    return redirectAbsolute(request, `/admin/settings?${params.toString()}`, 303);
  }

  try {
    await updateSettings(locals.supabase, result.data as Parameters<typeof updateSettings>[1], locals.user);
    if (contentType.includes('application/json')) return jsonOk({ updated: true });
    return redirectAbsolute(request, 
      `/admin/settings?toast=${encodeURIComponent('Pengaturan situs berhasil diperbarui.')}&toastType=success`,
      303
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memperbarui pengaturan situs.';
    if (contentType.includes('application/json')) return jsonError(message, 500);
    return redirectAbsolute(request, `/admin/settings?toast=${encodeURIComponent(message)}&toastType=error`, 303);
  }
}

export const POST: APIRoute = async ({ request, locals }) => handleUpdate(request, locals);
export const PUT: APIRoute = async ({ request, locals }) => handleUpdate(request, locals);
