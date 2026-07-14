// =============================================================================
// /api/admin/contacts/[id] — delete a single contact message. Contacts have
// no admin-side Create or Edit (they only ever originate from
// `/api/public/contact`), so unlike testimonials/[id].ts this route only
// handles delete, not update.
//
// Native HTML forms can only submit GET/POST, so ConfirmDeleteModal's form
// POSTs here with a hidden `_method=DELETE` field. A true DELETE handler is
// also exported for programmatic/fetch callers, sharing the same logic
// (ARCHITECTURE.md §9/§10). Mirrors /api/admin/testimonials/[id].ts.
//
// Permanent delete (`?permanent=1`) is admin-only per the master prompt
// ("Admin: semua akses termasuk permanent delete").
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { jsonOk, jsonError, redirectAbsolute } from '@/utils/response';
import { softDeleteContact, hardDeleteContact } from '@/services';

export const prerender = false;

async function handleSoftDelete(request: Request, id: string, locals: App.Locals, wantsJson: boolean) {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses.', 403);
  }
  try {
    await softDeleteContact(locals.supabase, id, locals.user);
    if (wantsJson) return jsonOk({ deleted: true });
    return redirectAbsolute(request, `/admin/contacts?toast=${encodeURIComponent('Pesan dipindahkan ke arsip.')}&toastType=success`, 303);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menghapus pesan kontak.';
    if (wantsJson) return jsonError(message, 500);
    return redirectAbsolute(request, `/admin/contacts?toast=${encodeURIComponent(message)}&toastType=error`, 303);
  }
}

async function handlePermanentDelete(request: Request, id: string, locals: App.Locals, wantsJson: boolean) {
  if (!requireRole(locals.user, ['admin'])) {
    return jsonError('Hanya admin yang dapat menghapus permanen.', 403);
  }
  try {
    await hardDeleteContact(locals.supabase, id, locals.user);
    if (wantsJson) return jsonOk({ deleted: true, permanent: true });
    return redirectAbsolute(request, `/admin/contacts/trash?toast=${encodeURIComponent('Pesan dihapus permanen.')}&toastType=success`, 303);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menghapus permanen pesan kontak.';
    if (wantsJson) return jsonError(message, 500);
    return redirectAbsolute(request, `/admin/contacts/trash?toast=${encodeURIComponent(message)}&toastType=error`, 303);
  }
}

export const POST: APIRoute = async ({ request, params, locals }) => {
  const id = params.id!;
  // Native forms can't send DELETE — read the spoofed method field instead.
  const clone = request.clone();
  const contentType = request.headers.get('content-type') || '';
  let method = 'DELETE';
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const fd = await clone.formData();
    method = String(fd.get('_method') ?? 'DELETE').toUpperCase();
  }

  const url = new URL(request.url);
  const permanent = url.searchParams.get('permanent') === '1';
  if (method === 'DELETE') {
    return permanent ? handlePermanentDelete(request, id, locals, false) : handleSoftDelete(request, id, locals, false);
  }
  return jsonError('Metode tidak didukung.', 405);
};

export const DELETE: APIRoute = async ({ request, params, locals }) => {
  const url = new URL(request.url);
  const permanent = url.searchParams.get('permanent') === '1';
  const wantsJson = (request.headers.get('accept') || '').includes('application/json');
  return permanent
    ? handlePermanentDelete(request, params.id!, locals, wantsJson)
    : handleSoftDelete(request, params.id!, locals, wantsJson);
};
