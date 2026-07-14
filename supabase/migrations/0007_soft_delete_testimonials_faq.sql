-- =========================================================================
-- Travel Management — Soft Delete for Testimonials & FAQ (Batch 3A-4)
-- Extends the same soft-delete pattern introduced in 0006_soft_delete.sql
-- (destinations/tours/blogs/gallery) to `testimonials` and `faq`, needed for
-- the Batch 3A-4 admin modules (Testimonials moderation + FAQ CRUD), which
-- both require Soft Delete / Restore / Permanent Delete.
--
-- Why this doesn't break existing queries: exactly the same reasoning as
-- 0006_soft_delete.sql — the exclusion is enforced at the RLS policy level,
-- so `src/pages/testimonials.astro` and `src/pages/faq.astro` (Batch 2,
-- untouched) keep working unchanged. The `src/services/*.service.ts` layer
-- also filters `deleted_at` explicitly for staff-scoped queries.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Add deleted_at columns
-- -------------------------------------------------------------------------
alter table public.testimonials add column if not exists deleted_at timestamptz;
alter table public.faq         add column if not exists deleted_at timestamptz;

create index if not exists idx_testimonials_deleted_at on public.testimonials (deleted_at);
create index if not exists idx_faq_deleted_at           on public.faq (deleted_at);

-- -------------------------------------------------------------------------
-- 2. Update RLS public-read policies to exclude soft-deleted rows.
--    Staff (is_staff()) keep seeing everything, including trashed rows, so
--    the new "Arsip" (trash) admin views can list/restore them.
-- -------------------------------------------------------------------------
drop policy if exists "testimonials_public_read" on public.testimonials;
create policy "testimonials_public_read" on public.testimonials
  for select using ((deleted_at is null and status = 'approved') or public.is_staff());

drop policy if exists "faq_public_read" on public.faq;
create policy "faq_public_read" on public.faq
  for select using ((deleted_at is null and status = 'published') or public.is_staff());

-- =========================================================================
-- END OF 0007_soft_delete_testimonials_faq.sql
-- =========================================================================
