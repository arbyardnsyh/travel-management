// =============================================================================
// POST /api/admin/users — create a new staff account (Batch 3A-8).
// Admin-only per the master prompt ("Create User" is not in the Editor's
// allowed list) and per ARCHITECTURE.md §9 ("Users: create/update memakai
// createAdminSupabaseClient() ... dibatasi hanya role admin"). Plain native
// `<form method="post">` submit from /admin/users/create, mirroring
// /api/admin/blogs/index.ts.
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { userCreateSchema } from '@/lib/validation/user.schema';
import { parseFormData } from '@/utils/parse-form';
import { jsonError } from '@/utils/response';
import { createUser } from '@/services';

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!requireRole(locals.user, ['admin'])) {
    return jsonError('Hanya admin yang dapat menambahkan pengguna.', 403);
  }

  const formData = await request.formData();
  const result = parseFormData(formData, userCreateSchema);

  if (!result.success) {
    const params = new URLSearchParams();
    params.set('toast', 'Periksa kembali data yang diisi.');
    params.set('toastType', 'error');
    for (const [key, message] of Object.entries(result.fieldErrors)) {
      params.set(`error_${key}`, message);
    }
    return redirect(`/admin/users/create?${params.toString()}`);
  }

  try {
    const user = await createUser(result.data, locals.user);
    return redirect(`/admin/users?toast=${encodeURIComponent(`Pengguna "${user.name}" berhasil ditambahkan.`)}&toastType=success`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menambahkan pengguna.';
    return redirect(`/admin/users/create?toast=${encodeURIComponent(message)}&toastType=error`);
  }
};
