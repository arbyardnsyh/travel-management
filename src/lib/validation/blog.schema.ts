import { z } from 'zod';
import { requiredString, optionalString, slugSchema, contentStatusSchema, imagePathSchema } from './common.schema';

/** Admin create/edit form for `/admin/blogs/*` (Batch 3). */
export const blogSchema = z.object({
  category_id: z
    .string()
    .uuid('Kategori tidak valid.')
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  title: requiredString('Judul artikel', 200),
  slug: slugSchema,
  thumbnail: imagePathSchema,
  content: optionalString(50000),
  author: optionalString(100),
  published_at: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  status: contentStatusSchema.optional().default('draft'),
});

export type BlogFormInput = z.infer<typeof blogSchema>;

/** Admin create/edit for `/admin/blogs/categories` (Batch 3). */
export const blogCategorySchema = z.object({
  name: requiredString('Nama kategori', 100),
  slug: slugSchema,
});

export type BlogCategoryFormInput = z.infer<typeof blogCategorySchema>;
