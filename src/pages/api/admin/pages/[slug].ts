// =============================================================================
// /api/admin/pages/[slug] — update + publish a static CMS page
// (about/privacy/terms). Batch 3A-7.
//
// `pages_staff_update` in 0002_rls_policies.sql (Batch 2, untouched) already
// allows both admin and editor to write `public.pages`, so both roles pass
// `requireRole` here — unlike /api/admin/settings.ts which is admin-only.
//
// Two intents share this single endpoint (mirrors ARCHITECTURE.md's
// `PUT /api/admin/pages/[slug]` — one route, not two):
//   - Normal save (Edit form "Simpan Perubahan") → validates the full form
//     and calls upsertPage(), logged as a plain "update".
//   - Publish (dedicated "Publish" button, sends hidden `_intent=publish`)
//     → skips form validation entirely and calls publishPage(), logged as
//     its own "status_change" activity entry per the master prompt.
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { staticPageSchema } from '@/lib/validation/settings.schema';
import { parseFormData, parseJsonBody } from '@/utils/parse-form';
import { jsonOk, jsonError, redirectAbsolute } from '@/utils/response';
import { upsertPage, publishPage } from '@/services';

export const prerender = false;

const ALLOWED_SLUGS = ['about', 'privacy', 'terms'];

async function handlePublish(request: Request, slug: string, locals: App.Locals, wantsJson: boolean) {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses.', 403);
  }
  try {
    const page = await publishPage(locals.supabase, slug, locals.user);
    if (wantsJson) return jsonOk(page);
    return redirectAbsolute(request, 
      `/admin/settings/${slug}?toast=${encodeURIComponent(`Halaman "${page.title}" berhasil dipublikasikan.`)}&toastType=success`,
      303
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal mempublikasikan halaman.';
    if (wantsJson) return jsonError(message, 500);
    return redirectAbsolute(request, `/admin/settings/${slug}?toast=${encodeURIComponent(message)}&toastType=error`, 303);
  }
}

async function handleUpdate(request: Request, slug: string, locals: App.Locals) {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses.', 403);
  }

  const contentType = request.headers.get('content-type') || '';
  const result = contentType.includes('application/json')
    ? parseJsonBody(await request.json(), staticPageSchema.partial())
    : parseFormData(await request.formData(), staticPageSchema);

  if (!result.success) {
    if (contentType.includes('application/json')) {
      return jsonError(JSON.stringify(result.fieldErrors), 422);
    }
    const params = new URLSearchParams({ toast: 'Periksa kembali data yang diisi.', toastType: 'error' });
    return redirectAbsolute(request, `/admin/settings/${slug}?${params.toString()}`, 303);
  }

  try {
    const page = await upsertPage(locals.supabase, slug, result.data as Parameters<typeof upsertPage>[2], locals.user);
    if (contentType.includes('application/json')) return jsonOk(page);
    return redirectAbsolute(request, 
      `/admin/settings/${slug}?toast=${encodeURIComponent(`Halaman "${page.title}" berhasil diperbarui.`)}&toastType=success`,
      303
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memperbarui halaman.';
    if (contentType.includes('application/json')) return jsonError(message, 500);
    return redirectAbsolute(request, `/admin/settings/${slug}?toast=${encodeURIComponent(message)}&toastType=error`, 303);
  }
}

export const POST: APIRoute = async ({ request, params, locals }) => {
  const slug = params.slug!;
  if (!ALLOWED_SLUGS.includes(slug)) {
    return jsonError('Halaman tidak dikenal.', 404);
  }

  const clone = request.clone();
  const contentType = request.headers.get('content-type') || '';
  let intent = 'update';
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const fd = await clone.formData();
    intent = String(fd.get('_intent') ?? 'update').toLowerCase();
  }

  if (intent === 'publish') {
    return handlePublish(request, slug, locals, false);
  }
  return handleUpdate(request, slug, locals);
};

export const PUT: APIRoute = async ({ request, params, locals }) => {
  const slug = params.slug!;
  if (!ALLOWED_SLUGS.includes(slug)) {
    return jsonError('Halaman tidak dikenal.', 404);
  }
  const url = new URL(request.url);
  if (url.searchParams.get('intent') === 'publish') {
    const wantsJson = (request.headers.get('accept') || '').includes('application/json');
    return handlePublish(request, slug, locals, wantsJson);
  }
  return handleUpdate(request, slug, locals);
};
