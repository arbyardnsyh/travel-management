-- =========================================================================
-- Travel Management — Soft Delete (Enhancement Batch)
-- Adds `deleted_at` to destinations, tours, blogs, gallery and updates their
-- public-read RLS policies to hide soft-deleted rows automatically.
--
-- IMPORTANT — why this doesn't break existing queries:
-- `src/pages/index.astro` and other Batch 1 code query these tables with
-- plain `.eq('status', 'published')` and never mention `deleted_at`. Because
-- the exclusion is enforced here at the RLS policy level (not only in
-- application code), those existing queries keep working unchanged — a
-- soft-deleted row simply becomes invisible to anon/public requests without
-- any app code needing to add `.is('deleted_at', null)` itself. The new
-- `src/services/*.service.ts` layer adds that filter explicitly too, purely
-- so staff-scoped queries (which bypass RLS via is_staff()) also default to
-- hiding trashed rows in normal admin lists.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Add deleted_at columns
-- -------------------------------------------------------------------------
alter table public.destinations add column if not exists deleted_at timestamptz;
alter table public.tours        add column if not exists deleted_at timestamptz;
alter table public.blogs        add column if not exists deleted_at timestamptz;
alter table public.gallery      add column if not exists deleted_at timestamptz;

create index if not exists idx_destinations_deleted_at on public.destinations (deleted_at);
create index if not exists idx_tours_deleted_at        on public.tours (deleted_at);
create index if not exists idx_blogs_deleted_at         on public.blogs (deleted_at);
create index if not exists idx_gallery_deleted_at       on public.gallery (deleted_at);

-- -------------------------------------------------------------------------
-- 2. Update RLS public-read policies to exclude soft-deleted rows.
--    Staff (is_staff()) keep seeing everything, including trashed rows, so
--    a future "Trash" admin view can list/restore them.
-- -------------------------------------------------------------------------
drop policy if exists "destinations_public_read" on public.destinations;
create policy "destinations_public_read" on public.destinations
  for select using ((deleted_at is null and status = 'published') or public.is_staff());

drop policy if exists "tours_public_read" on public.tours;
create policy "tours_public_read" on public.tours
  for select using ((deleted_at is null and status = 'published') or public.is_staff());

drop policy if exists "blogs_public_read" on public.blogs;
create policy "blogs_public_read" on public.blogs
  for select using ((deleted_at is null and status = 'published') or public.is_staff());

drop policy if exists "gallery_public_read" on public.gallery;
create policy "gallery_public_read" on public.gallery
  for select using (deleted_at is null or public.is_staff());

-- destination_gallery visibility depends on its parent destination, so a
-- soft-deleted destination should also hide its gallery photos from anon.
drop policy if exists "destination_gallery_public_read" on public.destination_gallery;
create policy "destination_gallery_public_read" on public.destination_gallery
  for select using (
    public.is_staff() or exists (
      select 1 from public.destinations d
      where d.id = destination_id
        and d.status = 'published'
        and d.deleted_at is null
    )
  );

-- =========================================================================
-- END OF 0006_soft_delete.sql
-- =========================================================================
