// =============================================================================
// POST /api/admin/faq — create a FAQ entry.
// Plain native `<form method="post">` submit from /admin/faq/create
// (ARCHITECTURE.md §9): validate → insert → redirect with ?toast=...
// Mirrors /api/admin/gallery/index.ts.
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { faqSchema } from '@/lib/validation/faq.schema';
import { parseFormData } from '@/utils/parse-form';
import { jsonError } from '@/utils/response';
import { createFaq } from '@/services';

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses.', 403);
  }

  const formData = await request.formData();
  const result = parseFormData(formData, faqSchema);

  if (!result.success) {
    const params = new URLSearchParams();
    params.set('toast', 'Periksa kembali data yang diisi.');
    params.set('toastType', 'error');
    for (const [key, message] of Object.entries(result.fieldErrors)) {
      params.set(`error_${key}`, message);
    }
    // Re-render the form with errors instead of losing the user's input.
    return redirect(`/admin/faq/create?${params.toString()}`);
  }

  try {
    const faq = await createFaq(locals.supabase, result.data as Parameters<typeof createFaq>[1], locals.user);
    return redirect(`/admin/faq?toast=${encodeURIComponent(`Pertanyaan "${faq.question}" berhasil ditambahkan.`)}&toastType=success`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menyimpan FAQ.';
    return redirect(`/admin/faq/create?toast=${encodeURIComponent(message)}&toastType=error`);
  }
};
