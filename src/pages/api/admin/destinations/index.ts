// =============================================================================
// POST /api/admin/destinations — create a destination.
// Plain native `<form method="post">` submit from /admin/destinations/create
// (ARCHITECTURE.md §9): validate → insert → redirect with ?toast=...
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { destinationSchema } from '@/lib/validation/destination.schema';
import { parseFormData } from '@/utils/parse-form';
import { jsonError } from '@/utils/response';
import { createDestination } from '@/services';

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses.', 403);
  }

  const formData = await request.formData();
  const result = parseFormData(formData, destinationSchema);

  if (!result.success) {
    const params = new URLSearchParams();
    params.set('toast', 'Periksa kembali data yang diisi.');
    params.set('toastType', 'error');
    for (const [key, message] of Object.entries(result.fieldErrors)) {
      params.set(`error_${key}`, message);
    }
    // Re-render the form with errors instead of losing the user's input.
    return redirect(`/admin/destinations/create?${params.toString()}`);
  }

  try {
    const destination = await createDestination(locals.supabase, result.data as Parameters<typeof createDestination>[1], locals.user);
    return redirect(`/admin/destinations?toast=${encodeURIComponent(`Destinasi "${destination.name}" berhasil ditambahkan.`)}&toastType=success`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menyimpan destinasi.';
    return redirect(`/admin/destinations/create?toast=${encodeURIComponent(message)}&toastType=error`);
  }
};
