-- =========================================================================
-- Travel Management — Soft Delete for Bookings (Batch 3A-5)
-- Extends the same soft-delete pattern introduced in 0006_soft_delete.sql
-- (destinations/tours/blogs/gallery) and 0007_soft_delete_testimonials_faq.sql
-- (testimonials/faq) to `bookings`, needed for the Batch 3A-5 admin module
-- (Booking List), which requires Soft Delete / Restore / Permanent Delete.
--
-- Why this doesn't break existing queries: `bookings` has no public-read RLS
-- policy at all (only `bookings_staff_select` — see 0002_rls_policies.sql),
-- so unlike destinations/tours/blogs/gallery/testimonials/faq there is no
-- public-facing policy to update here. Only `src/services/booking.service.ts`
-- (staff-only) ever reads this table, and it filters `deleted_at` explicitly,
-- matching the approach already used for staff-scoped queries on the other
-- soft-deletable tables.
-- =========================================================================

alter table public.bookings add column if not exists deleted_at timestamptz;

create index if not exists idx_bookings_deleted_at on public.bookings (deleted_at);

-- =========================================================================
-- END OF 0008_soft_delete_bookings.sql
-- =========================================================================
