// =============================================================================
// POST /api/admin/blogs — create a blog article.
// Plain native `<form method="post">` submit from /admin/blogs/create
// (ARCHITECTURE.md §9): validate → insert → redirect with ?toast=...
// Mirrors /api/admin/destinations/index.ts.
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { blogSchema } from '@/lib/validation/blog.schema';
import { parseFormData } from '@/utils/parse-form';
import { jsonError } from '@/utils/response';
import { createBlog } from '@/services';

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses.', 403);
  }

  const formData = await request.formData();
  const result = parseFormData(formData, blogSchema);

  if (!result.success) {
    const params = new URLSearchParams();
    params.set('toast', 'Periksa kembali data yang diisi.');
    params.set('toastType', 'error');
    for (const [key, message] of Object.entries(result.fieldErrors)) {
      params.set(`error_${key}`, message);
    }
    return redirect(`/admin/blogs/create?${params.toString()}`);
  }

  try {
    const blog = await createBlog(locals.supabase, result.data as Parameters<typeof createBlog>[1], locals.user);
    return redirect(`/admin/blogs?toast=${encodeURIComponent(`Artikel "${blog.title}" berhasil ditambahkan.`)}&toastType=success`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menyimpan artikel.';
    return redirect(`/admin/blogs/create?toast=${encodeURIComponent(message)}&toastType=error`);
  }
};
