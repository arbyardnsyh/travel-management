import { z } from 'zod';
import { requiredString, optionalString, contentStatusSchema } from './common.schema';

/** Admin form for `/admin/settings` — single-row site configuration (Batch 3). */
export const settingsSchema = z.object({
  website_name: requiredString('Nama website', 150),
  logo: optionalString(500),
  favicon: optionalString(500),
  address: optionalString(300),
  phone: optionalString(30),
  email: z
    .string()
    .trim()
    .email('Format email tidak valid.')
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  facebook: optionalString(300),
  instagram: optionalString(300),
  youtube: optionalString(300),
  whatsapp: optionalString(30),
  hero_title: optionalString(200),
  hero_subtitle: optionalString(300),
  hero_image: optionalString(500),
});

export type SettingsFormInput = z.infer<typeof settingsSchema>;

/** Admin editor for `/admin/settings/about|privacy|terms` (Batch 3) — targets `public.pages`. */
export const staticPageSchema = z.object({
  title: requiredString('Judul halaman', 200),
  content: optionalString(50000),
  meta_title: optionalString(200),
  meta_description: optionalString(300),
  // Added for Batch 3A-7 — `pages.status` didn't exist before the 0009
  // migration, so no schema previously covered it. Optional because the
  // dedicated "Publish" action (see publishPage() in page.service.ts) sets
  // this directly without going through the full edit form.
  status: contentStatusSchema.optional(),
});

export type StaticPageFormInput = z.infer<typeof staticPageSchema>;
