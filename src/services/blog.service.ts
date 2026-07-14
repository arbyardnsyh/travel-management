// =============================================================================
// Blog service — centralizes all `public.blogs` Supabase access
// (Enhancement Batch). Blog categories are read-only helpers here; a
// dedicated blog-category service can be added later following this same
// pattern if Batch 3 needs full CRUD on categories.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Blog, BlogCategory, Paginated, UserProfile, ContentStatus } from '@/lib/database.types';
import { logActivity } from '@/lib/activity-log';
import { generateUniqueSlug } from '@/utils/slug';
import { resolvePageParams, toPaginated, throwIfError, type BaseListParams } from './_shared';

const TABLE = 'blogs';
const WITH_CATEGORY_SELECT = '*, category:blog_categories(id, name, slug)';

export interface ListBlogsParams extends BaseListParams {
  status?: ContentStatus;
  categoryId?: string;
  onlyDeleted?: boolean;
}

export interface BlogInput {
  category_id?: string | null;
  title: string;
  slug?: string;
  thumbnail?: string | null;
  content?: string | null;
  author?: string | null;
  published_at?: string | null;
  status?: ContentStatus;
}

export async function listBlogs(supabase: SupabaseClient, params: ListBlogsParams = {}): Promise<Paginated<Blog>> {
  const { page, perPage, from, to } = resolvePageParams(params);

  let query = supabase.from(TABLE).select(WITH_CATEGORY_SELECT, { count: 'exact' });
  query = params.onlyDeleted ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null);
  if (params.status) query = query.eq('status', params.status);
  if (params.categoryId) query = query.eq('category_id', params.categoryId);
  if (params.q) query = query.ilike('title', `%${params.q}%`);

  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to);
  throwIfError(error);
  return toPaginated(data as unknown as Blog[] | null, count, page, perPage);
}

export async function getBlogById(supabase: SupabaseClient, id: string): Promise<Blog | null> {
  const { data, error } = await supabase.from(TABLE).select(WITH_CATEGORY_SELECT).eq('id', id).maybeSingle();
  throwIfError(error);
  return (data as unknown as Blog | null) ?? null;
}

export async function getBlogBySlug(supabase: SupabaseClient, slug: string): Promise<Blog | null> {
  const { data, error } = await supabase.from(TABLE).select(WITH_CATEGORY_SELECT).eq('slug', slug).maybeSingle();
  throwIfError(error);
  return (data as unknown as Blog | null) ?? null;
}

export async function listBlogCategories(supabase: SupabaseClient): Promise<BlogCategory[]> {
  const { data, error } = await supabase.from('blog_categories').select('*').order('name', { ascending: true });
  throwIfError(error);
  return (data as BlogCategory[]) ?? [];
}

/**
 * Count of active (non-deleted) blog articles — powers the Dashboard
 * "Total Blog Articles" stat card (Batch 3A-10).
 */
export async function countBlogs(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase.from(TABLE).select('id', { count: 'exact', head: true }).is('deleted_at', null);
  throwIfError(error);
  return count ?? 0;
}

/**
 * Breakdown of active (non-deleted) blog articles by `status` — powers the
 * Dashboard's "Blog Published vs Draft" chart (Batch 3A-10). Fetches only
 * the `status` column and aggregates in-memory rather than issuing one
 * `head: true` count query per status, since a single lightweight query
 * here always returns the same total row count either way.
 */
export async function getBlogPublishStats(
  supabase: SupabaseClient
): Promise<Record<ContentStatus, number>> {
  const { data, error } = await supabase.from(TABLE).select('status').is('deleted_at', null);
  throwIfError(error);
  const counts: Record<ContentStatus, number> = { draft: 0, published: 0, archived: 0 };
  for (const row of (data ?? []) as Array<{ status: ContentStatus }>) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
}

async function isSlugTaken(supabase: SupabaseClient, slug: string, excludeId?: string): Promise<boolean> {
  let query = supabase.from(TABLE).select('id', { count: 'exact', head: true }).eq('slug', slug);
  if (excludeId) query = query.neq('id', excludeId);
  const { count } = await query;
  return (count ?? 0) > 0;
}

export async function createBlog(supabase: SupabaseClient, input: BlogInput, actor: UserProfile | null): Promise<Blog> {
  const slug = input.slug?.trim()
    ? input.slug.trim()
    : await generateUniqueSlug(input.title, (candidate) => isSlugTaken(supabase, candidate));

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, slug, created_by: actor?.id ?? null })
    .select('*')
    .single();
  throwIfError(error);

  await logActivity(supabase, {
    actor,
    action: 'create',
    entity: 'blogs',
    entityId: data.id,
    description: `Menambahkan artikel "${data.title}"`,
  });
  return data as Blog;
}

export async function updateBlog(
  supabase: SupabaseClient,
  id: string,
  input: Partial<BlogInput>,
  actor: UserProfile | null
): Promise<Blog> {
  const payload: Partial<BlogInput> = { ...input };
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
    entity: 'blogs',
    entityId: id,
    description: `Memperbarui artikel "${data.title}"`,
  });
  return data as Blog;
}

export async function softDeleteBlog(supabase: SupabaseClient, id: string, actor: UserProfile | null): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ deleted_at: new Date().toISOString() }).eq('id', id);
  throwIfError(error);
  await logActivity(supabase, { actor, action: 'soft_delete', entity: 'blogs', entityId: id, description: 'Menghapus (arsip) artikel' });
}

export async function restoreBlog(supabase: SupabaseClient, id: string, actor: UserProfile | null): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ deleted_at: null }).eq('id', id);
  throwIfError(error);
  await logActivity(supabase, { actor, action: 'restore', entity: 'blogs', entityId: id, description: 'Memulihkan artikel dari arsip' });
}

export async function hardDeleteBlog(supabase: SupabaseClient, id: string, actor: UserProfile | null): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  throwIfError(error);
  await logActivity(supabase, { actor, action: 'delete', entity: 'blogs', entityId: id, description: 'Menghapus permanen artikel' });
}
