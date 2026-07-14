-- =============================================================================
-- 0009_pages_publish_status.sql — Batch 3A-7 (Website Settings module)
--
-- WHY: the master prompt for this batch requires a "Publish" feature for the
-- About/Privacy/Terms editors (Edit, RichTextEditor, Preview, Publish), but
-- `public.pages` (0001_init_schema.sql §15) has no state to publish *from* —
-- it only ever had `title`/`content`/`meta_title`/`meta_description` with no
-- draft/published distinction. Every other editable content table already
-- reuses the shared `content_status` enum (destinations, tours, blogs, faq),
-- so this migration brings `pages` in line with that existing convention
-- instead of inventing a new ad-hoc flag.
--
-- SCOPE: purely additive — two new nullable-with-default columns, no changes
-- to existing columns, indexes, RLS policies, or any other table. Existing
-- rows are backfilled to 'published' (they were already live on the public
-- site before this column existed), so public.astro/about.astro etc. keep
-- working unchanged.
-- =============================================================================

alter table public.pages
  add column if not exists status content_status not null default 'published',
  add column if not exists published_at timestamptz;

-- Backfill: rows created before this migration were implicitly "live" on the
-- public site, so treat their existing updated_at as their publish date.
update public.pages
set published_at = updated_at
where published_at is null and status = 'published';

create index if not exists idx_pages_status on public.pages (status);

-- =========================================================================
-- END OF 0009_pages_publish_status.sql
-- =========================================================================
