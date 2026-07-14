// =============================================================================
// POST /api/admin/blogs/categories — create a blog category.
// Plain native `<form method="post">` submit from
// /admin/blogs/categories/create (ARCHITECTURE.md §9): validate → insert →
// redirect with ?toast=... Mirrors /api/admin/faq/index.ts.
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { blogCategorySchema } from '@/lib/validation/blog.schema';
import { parseFormData } from '@/utils/parse-form';
import { jsonError } from '@/utils/response';
import { createBlogCategory } from '@/services';

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses.', 403);
  }

  const formData = await request.formData();
  const result = parseFormData(formData, blogCategorySchema);

  if (!result.success) {
    const params = new URLSearchParams();
    params.set('toast', 'Periksa kembali data yang diisi.');
    params.set('toastType', 'error');
    for (const [key, message] of Object.entries(result.fieldErrors)) {
      params.set(`error_${key}`, message);
    }
    return redirect(`/admin/blogs/categories/create?${params.toString()}`);
  }

  try {
    const category = await createBlogCategory(locals.supabase, result.data, locals.user);
    return redirect(
      `/admin/blogs/categories?toast=${encodeURIComponent(`Kategori "${category.name}" berhasil ditambahkan.`)}&toastType=success`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menyimpan kategori.';
    return redirect(`/admin/blogs/categories/create?toast=${encodeURIComponent(message)}&toastType=error`);
  }
};
