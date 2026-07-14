-- =========================================================================
-- Travel Management — Initial Schema
-- Project   : TravelTime (frontend) + PowerAdmin (dashboard)
-- Database  : Supabase PostgreSQL
-- Convention: UUID PK, snake_case, created_at/updated_at, soft references
-- =========================================================================

-- -------------------------------------------------------------------------
-- 0. EXTENSIONS
-- -------------------------------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "uuid-ossp";     -- uuid_generate_v4() fallback
create extension if not exists "pg_trgm";       -- fast ILIKE / search

-- -------------------------------------------------------------------------
-- 1. ENUM TYPES
-- -------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('admin', 'editor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type content_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_status as enum ('pending', 'confirmed', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type moderation_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- -------------------------------------------------------------------------
-- 2. GENERIC updated_at TRIGGER FUNCTION
-- -------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -------------------------------------------------------------------------
-- 3. USERS (profile table synced 1:1 with Supabase Auth `auth.users`)
-- -------------------------------------------------------------------------
-- NOTE: Authentication itself (password hashing, sessions, magic links) is
-- fully handled by Supabase Auth (`auth.users`). This table only stores the
-- *application profile* (name, role) for every authenticated account and
-- shares the same primary key as `auth.users.id`. There is intentionally no
-- password column here — storing/managing password hashes ourselves would
-- duplicate and weaken what Supabase Auth already does securely.
create table if not exists public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null,
  email       text not null unique,
  role        user_role not null default 'editor',
  avatar_url  text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_users_role on public.users (role);
create index if not exists idx_users_email on public.users (email);

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new auth user is created.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'editor')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- -------------------------------------------------------------------------
-- 4. DESTINATIONS
-- -------------------------------------------------------------------------
create table if not exists public.destinations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  location      text not null,
  price         numeric(12, 2) not null default 0 check (price >= 0),
  duration      text,
  rating        numeric(2, 1) not null default 0 check (rating >= 0 and rating <= 5),
  description   text,
  thumbnail     text,
  cover_image   text,
  is_featured   boolean not null default false,
  status        content_status not null default 'draft',
  created_by    uuid references public.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_destinations_status on public.destinations (status);
create index if not exists idx_destinations_featured on public.destinations (is_featured) where is_featured = true;
create index if not exists idx_destinations_slug on public.destinations (slug);
create index if not exists idx_destinations_name_trgm on public.destinations using gin (name gin_trgm_ops);

drop trigger if exists trg_destinations_updated_at on public.destinations;
create trigger trg_destinations_updated_at
  before update on public.destinations
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- 5. DESTINATION GALLERY
-- -------------------------------------------------------------------------
create table if not exists public.destination_gallery (
  id              uuid primary key default gen_random_uuid(),
  destination_id  uuid not null references public.destinations (id) on delete cascade,
  image_url       text not null,
  caption         text,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists idx_destination_gallery_destination on public.destination_gallery (destination_id);

-- -------------------------------------------------------------------------
-- 6. TOURS
-- -------------------------------------------------------------------------
create table if not exists public.tours (
  id              uuid primary key default gen_random_uuid(),
  destination_id  uuid references public.destinations (id) on delete set null,
  title           text not null,
  slug            text not null unique,
  price           numeric(12, 2) not null default 0 check (price >= 0),
  duration        text,
  quota           integer not null default 0 check (quota >= 0),
  description     text,
  thumbnail       text,
  status          content_status not null default 'draft',
  created_by      uuid references public.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_tours_destination on public.tours (destination_id);
create index if not exists idx_tours_status on public.tours (status);
create index if not exists idx_tours_slug on public.tours (slug);
create index if not exists idx_tours_title_trgm on public.tours using gin (title gin_trgm_ops);

drop trigger if exists trg_tours_updated_at on public.tours;
create trigger trg_tours_updated_at
  before update on public.tours
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- 7. BOOKINGS
-- -------------------------------------------------------------------------
create table if not exists public.bookings (
  id              uuid primary key default gen_random_uuid(),
  tour_id         uuid not null references public.tours (id) on delete restrict,
  customer_name   text not null,
  customer_email  text not null,
  phone           text not null,
  participants    integer not null default 1 check (participants > 0),
  travel_date     date not null,
  notes           text,
  status          booking_status not null default 'pending',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_bookings_tour on public.bookings (tour_id);
create index if not exists idx_bookings_status on public.bookings (status);
create index if not exists idx_bookings_travel_date on public.bookings (travel_date);
create index if not exists idx_bookings_email on public.bookings (customer_email);

drop trigger if exists trg_bookings_updated_at on public.bookings;
create trigger trg_bookings_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- 8. TESTIMONIALS
-- -------------------------------------------------------------------------
create table if not exists public.testimonials (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  job         text,
  photo       text,
  rating      numeric(2, 1) not null default 5 check (rating >= 0 and rating <= 5),
  message     text not null,
  status      moderation_status not null default 'pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_testimonials_status on public.testimonials (status);

drop trigger if exists trg_testimonials_updated_at on public.testimonials;
create trigger trg_testimonials_updated_at
  before update on public.testimonials
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- 9. GALLERY (general site gallery, separate from destination_gallery)
-- -------------------------------------------------------------------------
create table if not exists public.gallery (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  image_url   text not null,
  category    text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_gallery_category on public.gallery (category);

-- -------------------------------------------------------------------------
-- 10. BLOG CATEGORIES
-- -------------------------------------------------------------------------
create table if not exists public.blog_categories (
  id    uuid primary key default gen_random_uuid(),
  name  text not null,
  slug  text not null unique
);

-- -------------------------------------------------------------------------
-- 11. BLOGS
-- -------------------------------------------------------------------------
create table if not exists public.blogs (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid references public.blog_categories (id) on delete set null,
  title         text not null,
  slug          text not null unique,
  thumbnail     text,
  content       text,
  author        text,
  published_at  timestamptz,
  status        content_status not null default 'draft',
  created_by    uuid references public.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_blogs_category on public.blogs (category_id);
create index if not exists idx_blogs_status on public.blogs (status);
create index if not exists idx_blogs_slug on public.blogs (slug);
create index if not exists idx_blogs_published_at on public.blogs (published_at desc);
create index if not exists idx_blogs_title_trgm on public.blogs using gin (title gin_trgm_ops);

drop trigger if exists trg_blogs_updated_at on public.blogs;
create trigger trg_blogs_updated_at
  before update on public.blogs
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- 12. FAQ
-- -------------------------------------------------------------------------
create table if not exists public.faq (
  id          uuid primary key default gen_random_uuid(),
  question    text not null,
  answer      text not null,
  sort_order  integer not null default 0,
  status      content_status not null default 'published',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_faq_status on public.faq (status);
create index if not exists idx_faq_sort_order on public.faq (sort_order);

drop trigger if exists trg_faq_updated_at on public.faq;
create trigger trg_faq_updated_at
  before update on public.faq
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- 13. CONTACTS (contact form submissions)
-- -------------------------------------------------------------------------
create table if not exists public.contacts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  subject     text,
  message     text not null,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_contacts_is_read on public.contacts (is_read);
create index if not exists idx_contacts_created_at on public.contacts (created_at desc);

-- -------------------------------------------------------------------------
-- 14. SETTINGS (single-row site configuration)
-- -------------------------------------------------------------------------
create table if not exists public.settings (
  id             uuid primary key default gen_random_uuid(),
  website_name   text not null default 'TravelTime',
  logo           text,
  favicon        text,
  address        text,
  phone          text,
  email          text,
  facebook       text,
  instagram      text,
  youtube        text,
  whatsapp       text,
  hero_title     text,
  hero_subtitle  text,
  hero_image     text,
  updated_at     timestamptz not null default now()
);

drop trigger if exists trg_settings_updated_at on public.settings;
create trigger trg_settings_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

-- Enforce a single settings row (site-wide config, not multi-tenant).
create unique index if not exists uq_settings_singleton on public.settings ((true));

-- -------------------------------------------------------------------------
-- 15. STATIC PAGES (About / Privacy / Terms editable content)
-- -------------------------------------------------------------------------
create table if not exists public.pages (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique, -- 'about' | 'privacy' | 'terms'
  title       text not null,
  content     text,
  meta_title        text,
  meta_description  text,
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_pages_updated_at on public.pages;
create trigger trg_pages_updated_at
  before update on public.pages
  for each row execute function public.set_updated_at();

-- =========================================================================
-- END OF 0001_init_schema.sql
-- =========================================================================
