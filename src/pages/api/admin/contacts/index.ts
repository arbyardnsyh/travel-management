// =============================================================================
// GET /api/admin/contacts — staff-only JSON listing of contact messages.
// The `/admin/contacts` page itself calls `listContacts()` directly (same
// convention as every other admin list page — see ARCHITECTURE.md §9), so
// this endpoint isn't used by that page's own render. It exists for
// programmatic/AJAX callers (e.g. a future unread-count badge poll) that
// need the same data as JSON, mirroring the read-only JSON endpoints already
// exposed elsewhere in `src/pages/api/admin/**`.
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { jsonOk, jsonError } from '@/utils/response';
import { listContacts } from '@/services';

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses.', 403);
  }

  const params = url.searchParams;
  const q = params.get('q') ?? undefined;
  const onlyUnread = params.get('unread') === '1';
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
  const perPage = Math.max(1, Number(params.get('perPage') ?? 10) || 10);

  try {
    const result = await listContacts(locals.supabase, { q, onlyUnread, page, perPage });
    return jsonOk(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memuat pesan kontak.';
    return jsonError(message, 500);
  }
};
