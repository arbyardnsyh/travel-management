# TravelTime + PowerAdmin — Travel Management (Astro + Supabase)

Satu project Astro yang menggabungkan:

- **Frontend** — template *TravelTime* (Bootstrap) sebagai website publik.
- **Dashboard Admin** — template *PowerAdmin* (Bootstrap) sebagai panel kelola konten.
- **Database** — Supabase PostgreSQL (Auth, Storage, RLS).

Status pengerjaan (dikerjakan bertahap per instruksi):

- [x] **Batch 1 — Fondasi** (project ini): scaffold Astro, konfigurasi, migration SQL lengkap (schema, RLS, storage, seed), `lib/supabase.ts`, `lib/auth.ts`, `lib/helpers.ts`, middleware proteksi `/admin`, layout publik & admin, halaman login, dashboard awal.
- [ ] **Batch 2** — Seluruh halaman frontend TravelTime (Home, About, Destinations, Destination Detail, Tours, Tour Detail, Booking, Gallery, Testimonials, Blog, Blog Detail, FAQ, Contact, Privacy, Terms).
- [ ] **Batch 3** — CRUD penuh dashboard admin (Destinations, Tours, Gallery, Testimonials, Blog, FAQ, Bookings, Users, Settings, Profile) + API routes + upload gambar.
- [ ] **Batch 4** — SEO (meta/OG/Twitter/canonical/sitemap/robots), `vercel.json` final, hardening & review end-to-end.

---

## 1. Menjalankan secara lokal

```bash
npm install
cp .env.example .env
# isi .env dengan kredensial Supabase Anda (lihat langkah 2)
npm run dev
```

Buka `http://localhost:4321`.

## 2. Setup Supabase

1. Buat project baru di [supabase.com](https://supabase.com).
2. Ambil `Project URL` dan `anon public key` dari **Project Settings → API**, isi ke:
   - `PUBLIC_SUPABASE_URL`
   - `PUBLIC_SUPABASE_ANON_KEY`
3. Ambil `service_role key` (⚠️ rahasia, jangan expose ke client) dari halaman yang sama, isi ke `SUPABASE_SERVICE_ROLE_KEY`.
4. Jalankan migration secara berurutan lewat **SQL Editor** Supabase (atau `supabase db push` jika memakai Supabase CLI):
   - `supabase/migrations/0001_init_schema.sql`
   - `supabase/migrations/0002_rls_policies.sql`
   - `supabase/migrations/0003_storage_buckets.sql`
   - `supabase/migrations/0004_seed.sql`
5. Aktifkan **Email provider** di **Authentication → Providers** (default biasanya sudah aktif).

## 3. Membuat akun admin pertama

Karena autentikasi memakai Supabase Auth (bukan tabel `password_hash` manual), buat user pertama lewat dashboard Supabase:

1. **Authentication → Users → Add user** → isi email & password, centang "Auto Confirm User".
2. Trigger `handle_new_auth_user` otomatis membuat baris profil di `public.users` dengan role default `editor`.
3. Jadikan admin dengan menjalankan di SQL Editor:
   ```sql
   update public.users set role = 'admin' where email = 'email-anda@example.com';
   ```
4. Login di `/login` dengan email & password tersebut → akan diarahkan ke `/admin/dashboard`.

## 4. Struktur folder penting

```
src/
  components/     # Header, Footer, AdminSidebar, AdminHeader, Toast, dll (reusable)
  layouts/        # PublicLayout.astro (TravelTime), AdminLayout.astro (PowerAdmin)
  lib/            # supabase.ts, auth.ts, helpers.ts, database.types.ts
  middleware/     # Proteksi seluruh /admin (redirect ke /login jika belum login)
  pages/          # Semua route (publik + admin + api)
supabase/
  migrations/     # SQL schema, RLS, storage, seed — jalankan berurutan
public/
  assets-user/    # Aset asli TravelTime (css/js/img/vendor)
  assets-admin/   # Aset asli PowerAdmin (css/js/img/vendor)
```

## 5. Deploy ke Vercel

1. Push project ke GitHub.
2. Import repo di Vercel → framework otomatis terdeteksi sebagai **Astro**.
3. Tambahkan environment variables yang sama seperti `.env` di **Project Settings → Environment Variables**.
4. Deploy. `vercel.json` & `astro.config.mjs` sudah dikonfigurasi dengan adapter `@astrojs/vercel`.

---

Dokumen ini akan diperbarui setiap batch selesai.
