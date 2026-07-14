-- =========================================================================
-- Travel Management — Row Level Security Policies
-- Roles: anon (public visitors), authenticated (logged in via Supabase Auth)
-- App roles (stored in public.users.role): admin | editor
-- =========================================================================

-- -------------------------------------------------------------------------
-- Helper: current app role of the logged-in user (SECURITY DEFINER to avoid
-- recursive RLS lookups on public.users itself).
-- -------------------------------------------------------------------------
create or replace function public.current_user_role()
returns user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role in ('admin', 'editor') and is_active = true
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$;

-- -------------------------------------------------------------------------
-- Enable RLS on every table
-- -------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.destinations enable row level security;
alter table public.destination_gallery enable row level security;
alter table public.tours enable row level security;
alter table public.bookings enable row level security;
alter table public.testimonials enable row level security;
alter table public.gallery enable row level security;
alter table public.blog_categories enable row level security;
alter table public.blogs enable row level security;
alter table public.faq enable row level security;
alter table public.contacts enable row level security;
alter table public.settings enable row level security;
alter table public.pages enable row level security;

-- -------------------------------------------------------------------------
-- USERS: staff can read all profiles, only admin manages, everyone can
-- read/update their own profile row.
-- -------------------------------------------------------------------------
create policy "users_select_self_or_staff" on public.users
  for select using (auth.uid() = id or public.is_staff());

create policy "users_update_self" on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "users_admin_all" on public.users
  for all using (public.is_admin()) with check (public.is_admin());

-- -------------------------------------------------------------------------
-- DESTINATIONS: public can read published rows; staff full access.
-- -------------------------------------------------------------------------
create policy "destinations_public_read" on public.destinations
  for select using (status = 'published' or public.is_staff());

create policy "destinations_staff_write" on public.destinations
  for insert with check (public.is_staff());
create policy "destinations_staff_update" on public.destinations
  for update using (public.is_staff()) with check (public.is_staff());
create policy "destinations_staff_delete" on public.destinations
  for delete using (public.is_staff());

-- -------------------------------------------------------------------------
-- DESTINATION GALLERY
-- -------------------------------------------------------------------------
create policy "destination_gallery_public_read" on public.destination_gallery
  for select using (
    public.is_staff() or exists (
      select 1 from public.destinations d
      where d.id = destination_id and d.status = 'published'
    )
  );
create policy "destination_gallery_staff_write" on public.destination_gallery
  for insert with check (public.is_staff());
create policy "destination_gallery_staff_update" on public.destination_gallery
  for update using (public.is_staff()) with check (public.is_staff());
create policy "destination_gallery_staff_delete" on public.destination_gallery
  for delete using (public.is_staff());

-- -------------------------------------------------------------------------
-- TOURS
-- -------------------------------------------------------------------------
create policy "tours_public_read" on public.tours
  for select using (status = 'published' or public.is_staff());
create policy "tours_staff_write" on public.tours
  for insert with check (public.is_staff());
create policy "tours_staff_update" on public.tours
  for update using (public.is_staff()) with check (public.is_staff());
create policy "tours_staff_delete" on public.tours
  for delete using (public.is_staff());

-- -------------------------------------------------------------------------
-- BOOKINGS: anyone (including anonymous visitors) can create a booking;
-- only staff can read/update/delete.
-- -------------------------------------------------------------------------
create policy "bookings_public_insert" on public.bookings
  for insert with check (true);
create policy "bookings_staff_select" on public.bookings
  for select using (public.is_staff());
create policy "bookings_staff_update" on public.bookings
  for update using (public.is_staff()) with check (public.is_staff());
create policy "bookings_staff_delete" on public.bookings
  for delete using (public.is_staff());

-- -------------------------------------------------------------------------
-- TESTIMONIALS: public can read approved; anyone can submit (pending);
-- staff moderate.
-- -------------------------------------------------------------------------
create policy "testimonials_public_read" on public.testimonials
  for select using (status = 'approved' or public.is_staff());
create policy "testimonials_public_insert" on public.testimonials
  for insert with check (status = 'pending' or public.is_staff());
create policy "testimonials_staff_update" on public.testimonials
  for update using (public.is_staff()) with check (public.is_staff());
create policy "testimonials_staff_delete" on public.testimonials
  for delete using (public.is_staff());

-- -------------------------------------------------------------------------
-- GALLERY
-- -------------------------------------------------------------------------
create policy "gallery_public_read" on public.gallery
  for select using (true);
create policy "gallery_staff_write" on public.gallery
  for insert with check (public.is_staff());
create policy "gallery_staff_update" on public.gallery
  for update using (public.is_staff()) with check (public.is_staff());
create policy "gallery_staff_delete" on public.gallery
  for delete using (public.is_staff());

-- -------------------------------------------------------------------------
-- BLOG CATEGORIES
-- -------------------------------------------------------------------------
create policy "blog_categories_public_read" on public.blog_categories
  for select using (true);
create policy "blog_categories_staff_write" on public.blog_categories
  for insert with check (public.is_staff());
create policy "blog_categories_staff_update" on public.blog_categories
  for update using (public.is_staff()) with check (public.is_staff());
create policy "blog_categories_staff_delete" on public.blog_categories
  for delete using (public.is_staff());

-- -------------------------------------------------------------------------
-- BLOGS
-- -------------------------------------------------------------------------
create policy "blogs_public_read" on public.blogs
  for select using (status = 'published' or public.is_staff());
create policy "blogs_staff_write" on public.blogs
  for insert with check (public.is_staff());
create policy "blogs_staff_update" on public.blogs
  for update using (public.is_staff()) with check (public.is_staff());
create policy "blogs_staff_delete" on public.blogs
  for delete using (public.is_staff());

-- -------------------------------------------------------------------------
-- FAQ
-- -------------------------------------------------------------------------
create policy "faq_public_read" on public.faq
  for select using (status = 'published' or public.is_staff());
create policy "faq_staff_write" on public.faq
  for insert with check (public.is_staff());
create policy "faq_staff_update" on public.faq
  for update using (public.is_staff()) with check (public.is_staff());
create policy "faq_staff_delete" on public.faq
  for delete using (public.is_staff());

-- -------------------------------------------------------------------------
-- CONTACTS: anyone can submit; only staff can read/manage.
-- -------------------------------------------------------------------------
create policy "contacts_public_insert" on public.contacts
  for insert with check (true);
create policy "contacts_staff_select" on public.contacts
  for select using (public.is_staff());
create policy "contacts_staff_update" on public.contacts
  for update using (public.is_staff()) with check (public.is_staff());
create policy "contacts_staff_delete" on public.contacts
  for delete using (public.is_staff());

-- -------------------------------------------------------------------------
-- SETTINGS: public read (needed to render the site); only admin can write.
-- -------------------------------------------------------------------------
create policy "settings_public_read" on public.settings
  for select using (true);
create policy "settings_admin_insert" on public.settings
  for insert with check (public.is_admin());
create policy "settings_admin_update" on public.settings
  for update using (public.is_admin()) with check (public.is_admin());

-- -------------------------------------------------------------------------
-- PAGES: public read; staff write.
-- -------------------------------------------------------------------------
create policy "pages_public_read" on public.pages
  for select using (true);
create policy "pages_staff_insert" on public.pages
  for insert with check (public.is_staff());
create policy "pages_staff_update" on public.pages
  for update using (public.is_staff()) with check (public.is_staff());

-- =========================================================================
-- END OF 0002_rls_policies.sql
-- =========================================================================
