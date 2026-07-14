-- =========================================================================
-- Travel Management — Supabase Storage buckets & policies
-- Folders used inside the single `media` bucket:
--   destination/  gallery/  blog/  logo/  testimonial/  hero/
-- =========================================================================

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Public read access for everyone (images must be publicly viewable on the
-- website without authentication).
create policy "media_public_read"
  on storage.objects for select
  using (bucket_id = 'media');

-- Only authenticated staff (admin/editor) can upload/update/delete files.
create policy "media_staff_insert"
  on storage.objects for insert
  with check (bucket_id = 'media' and public.is_staff());

create policy "media_staff_update"
  on storage.objects for update
  using (bucket_id = 'media' and public.is_staff())
  with check (bucket_id = 'media' and public.is_staff());

create policy "media_staff_delete"
  on storage.objects for delete
  using (bucket_id = 'media' and public.is_staff());

-- =========================================================================
-- END OF 0003_storage_buckets.sql
-- =========================================================================
