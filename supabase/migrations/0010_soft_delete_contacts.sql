-- =========================================================================
-- Travel Management — Soft Delete for Contacts (Batch 3A-11)
-- Extends the same soft-delete pattern introduced in 0006_soft_delete.sql
-- (destinations/tours/blogs/gallery), 0007_soft_delete_testimonials_faq.sql
-- (testimonials/faq), and 0008_soft_delete_bookings.sql (bookings) to
-- `contacts`, needed for the Batch 3A-11 admin module (Contact Management),
-- which requires Soft Delete / Restore / Permanent Delete.
--
-- Why this doesn't break existing queries: `contacts` has no public-read RLS
-- policy at all (only `contacts_staff_select` — see 0002_rls_policies.sql),
-- so unlike destinations/tours/blogs/gallery/testimonials/faq there is no
-- public-facing policy to update here. Only `src/services/contact.service.ts`
-- (staff-only reads; public insert only) ever reads this table, and it now
-- filters `deleted_at` explicitly, matching the approach already used for
-- staff-scoped queries on the other soft-deletable tables.
-- =========================================================================

alter table public.contacts add column if not exists deleted_at timestamptz;

create index if not exists idx_contacts_deleted_at on public.contacts (deleted_at);

-- =========================================================================
-- END OF 0010_soft_delete_contacts.sql
-- =========================================================================
