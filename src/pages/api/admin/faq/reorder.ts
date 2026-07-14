// =============================================================================
// POST /api/admin/faq/reorder — bulk-updates `sort_order` for all active FAQ
// rows in one call. Called via fetch (JSON body: { order: string[] }) from
// the move-up/move-down buttons on /admin/faq (ARCHITECTURE.md §9 exception
// for FAQ). Always expects the FULL list of active FAQ ids in their new
// order — not a partial page — so no row is left with a stale sort_order.
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { faqReorderSchema } from '@/lib/validation/faq.schema';
import { parseJsonBody } from '@/utils/parse-form';
import { jsonOk, jsonError } from '@/utils/response';
import { reorderFaqs } from '@/services';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses.', 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Body permintaan tidak valid.', 400);
  }

  const result = parseJsonBody(body, faqReorderSchema);
  if (!result.success) {
    return jsonError(Object.values(result.fieldErrors)[0] ?? 'Urutan tidak valid.', 422);
  }

  try {
    await reorderFaqs(locals.supabase, result.data.order, locals.user);
    return jsonOk({ reordered: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal mengubah urutan FAQ.';
    return jsonError(message, 500);
  }
};
