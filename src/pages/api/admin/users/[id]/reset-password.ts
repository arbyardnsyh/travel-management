// =============================================================================
// POST /api/admin/users/[id]/reset-password — "Reset Password" action
// (Batch 3A-8). Per the master prompt: "melalui Supabase Auth ... tanpa
// menyimpan password di database aplikasi" — this calls
// `auth.admin.updateUserById()` (service role) via
// `user.service.ts#resetUserPassword`, which generates a random temporary
// password and returns it ONCE in this JSON response so the admin can copy
// it and hand it to the user out-of-band. It is never written to
// `public.users` or persisted anywhere else in the app.
//
// JSON-only (no HTML-form fallback): unlike other admin actions here, the
// result (the generated password) has to be *shown*, not just redirected
// past in a toast, so this is always invoked via fetch() from
// /admin/users/[id]/index.astro's "Reset Password" button, mirroring how
// ImageUploader.astro already calls /api/admin/upload with fetch/XHR.
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { jsonOk, jsonError } from '@/utils/response';
import { resetUserPassword } from '@/services';

export const prerender = false;

export const POST: APIRoute = async ({ params, locals }) => {
  if (!requireRole(locals.user, ['admin'])) {
    return jsonError('Hanya admin yang dapat mereset password pengguna.', 403);
  }

  const id = params.id!;

  try {
    const { password } = await resetUserPassword(id, locals.user);
    return jsonOk({ password });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal mereset password pengguna.';
    return jsonError(message, 500);
  }
};
