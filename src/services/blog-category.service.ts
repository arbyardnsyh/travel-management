// =============================================================================
// Blog category service — centralizes all `public.blog_categories` Supabase
// access (Batch 3A-6). Companion to `blog.service.ts#listBlogCategories()`,
// which stays as a lightweight read-only helper for populating <select>
// dropdowns; this file adds the full CRUD needed for the dedicated
// `/admin/blogs/categories` module.
//
// NOTE ON SOFT DELETE: `public.blog_categories` (see
// supabase/migrations/0001_init_schema.sql §10) only has `id`, `name`, and
// `slug` — no `created_at` / `updated_at` / `deleted_at` columns, unlike
// every other content table (destinations/tours/blogs/gallery/testimonials/
// faq) which picked those up in 0006/0007. Per the master prompt ("Soft
// Delete jika memang didukung skema saat ini; jika belum, jelaskan alasannya
// dan jangan mengubah skema tanpa kebutuhan"), this module does NOT add a
// migration for it — categories are simple lookup rows referenced by
// `blogs.category_id` with `on delete set null`, so deleting one just
// detaches it from any articles instead of destroying content. Delete here
// is therefore a single permanent, admin-only operation with no
// restore/trash step. See the batch report for the full explanation.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BlogCategory, Paginated, UserProfile } from '@/lib/database.types';
import { logActivity } from '@/lib/activity-log';
import { generateUniqueSlug } from '@/utils/slug';
import { resolvePageParams, toPaginated, throwIfError, type BaseListParams } from './_shared';

const TABLE = 'blog_categories';

export interface ListBlogCategoriesParams extends BaseListParams {}

export interface BlogCategoryInput {
  name: string;
  slug?: string;
}

export async function listBlogCategoriesPaginated(
  supabase: SupabaseClient,
  params: ListBlogCategoriesParams = {}
): Promise<Paginated<BlogCategory>> {
  const { page, perPage, from, to } = resolvePageParams(params);

  let query = supabase.from(TABLE).select('*', { count: 'exact' });
  if (params.q) query = query.ilike('name', `%${params.q}%`);

  const { data, count, error } = await query.order('name', { ascending: true }).range(from, to);
  throwIfError(error);
  return toPaginated(data as BlogCategory[] | null, count, page, perPage);
}

export async function getBlogCategoryById(supabase: SupabaseClient, id: string): Promise<BlogCategory | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  throwIfError(error);
  return (data as BlogCategory | null) ?? null;
}

/**
 * Total count of blog categories — powers the Dashboard "Total Blog
 * Categories" stat card (Batch 3A-10). Named distinctly from
 * `countBlogsInCategory()` above (which counts articles *within* one
 * category) to avoid any confusion between the two.
 */
export async function countAllBlogCategories(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase.from(TABLE).select('id', { count: 'exact', head: true });
  throwIfError(error);
  return count ?? 0;
}

/** Count of active (non-deleted) blog articles currently attached to a category — shown on the detail page. */
export async function countBlogsInCategory(supabase: SupabaseClient, categoryId: string): Promise<number> {
  const { count, error } = await supabase
    .from('blogs')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId)
    .is('deleted_at', null);
  throwIfError(error);
  return count ?? 0;
}

async function isSlugTaken(supabase: SupabaseClient, slug: string, excludeId?: string): Promise<boolean> {
  let query = supabase.from(TABLE).select('id', { count: 'exact', head: true }).eq('slug', slug);
  if (excludeId) query = query.neq('id', excludeId);
  const { count } = await query;
  return (count ?? 0) > 0;
}

export async function createBlogCategory(
  supabase: SupabaseClient,
  input: BlogCategoryInput,
  actor: UserProfile | null
): Promise<BlogCategory> {
  const slug = input.slug?.trim()
    ? input.slug.trim()
    : await generateUniqueSlug(input.name, (candidate) => isSlugTaken(supabase, candidate));

  const { data, error } = await supabase.from(TABLE).insert({ name: input.name, slug }).select('*').single();
  throwIfError(error);

  await logActivity(supabase, {
    actor,
    action: 'create',
    entity: 'blog_categories',
    entityId: data.id,
    description: `Menambahkan kategori blog "${data.name}"`,
  });
  return data as BlogCategory;
}

export async function updateBlogCategory(
  supabase: SupabaseClient,
  id: string,
  input: Partial<BlogCategoryInput>,
  actor: UserProfile | null
): Promise<BlogCategory> {
  const payload: Partial<BlogCategoryInput> = { ...input };
  if (input.slug?.trim()) {
    payload.slug = (await isSlugTaken(supabase, input.slug.trim(), id))
      ? await generateUniqueSlug(input.slug.trim(), (candidate) => isSlugTaken(supabase, candidate, id))
      : input.slug.trim();
  }

  const { data, error } = await supabase.from(TABLE).update(payload).eq('id', id).select('*').single();
  throwIfError(error);

  await logActivity(supabase, {
    actor,
    action: 'update',
    entity: 'blog_categories',
    entityId: id,
    description: `Memperbarui kategori blog "${data.name}"`,
  });
  return data as BlogCategory;
}

/**
 * Permanently deletes a category. No soft-delete tier exists for this table
 * (see file header) — this is the only delete operation, and the calling
 * API route restricts it to `admin` only, matching every other module's
 * "Permanent Delete (Admin Only)" rule.
 */
export async function hardDeleteBlogCategory(supabase: SupabaseClient, id: string, actor: UserProfile | null): Promise<void> {
  const { data: existing } = await supabase.from(TABLE).select('name').eq('id', id).maybeSingle();
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  throwIfError(error);

  await logActivity(supabase, {
    actor,
    action: 'delete',
    entity: 'blog_categories',
    entityId: id,
    description: `Menghapus permanen kategori blog "${existing?.name ?? id}"`,
  });
}
