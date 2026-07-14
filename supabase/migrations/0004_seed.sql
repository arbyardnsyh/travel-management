-- =========================================================================
-- Travel Management — Seed data
-- Only structural/default data. NO dummy destinations/tours/blog content —
-- per project requirement, all real content is entered through the admin
-- dashboard.
-- =========================================================================

-- Default single settings row (safe to edit later from /admin/settings)
insert into public.settings (
  website_name, hero_title, hero_subtitle,
  address, phone, email
)
select
  'TravelTime',
  'Explore The World With Us',
  'Discover unforgettable destinations and book your next adventure with confidence.',
  'Jl. Contoh No. 123, Malang, Jawa Timur',
  '+62 812-0000-0000',
  'hello@traveltime.example'
where not exists (select 1 from public.settings);

-- Static pages placeholders (editable via /admin/settings/about, etc.)
insert into public.pages (slug, title, content)
values
  ('about', 'About Us', '<p>Tell your company story here. Edit this page from the admin dashboard.</p>'),
  ('privacy', 'Privacy Policy', '<p>Write your privacy policy here. Edit this page from the admin dashboard.</p>'),
  ('terms', 'Terms & Conditions', '<p>Write your terms and conditions here. Edit this page from the admin dashboard.</p>')
on conflict (slug) do nothing;

-- Default blog category so the admin isn't forced to create one before
-- writing the first article.
insert into public.blog_categories (name, slug)
values ('General', 'general')
on conflict (slug) do nothing;

-- =========================================================================
-- END OF 0004_seed.sql
-- =========================================================================
