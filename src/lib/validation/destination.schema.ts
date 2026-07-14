import { z } from 'zod';
import { requiredString, optionalString, numericString, slugSchema, contentStatusSchema, imagePathSchema } from './common.schema';

/** Admin create/edit form for `/admin/destinations/*` (Batch 3). */
export const destinationSchema = z.object({
  name: requiredString('Nama destinasi', 150),
  slug: slugSchema,
  location: requiredString('Lokasi', 150),
  price: numericString('Harga', 0),
  duration: optionalString(50),
  rating: z.coerce.number().min(0, 'Rating minimal 0.').max(5, 'Rating maksimal 5.').optional().default(0),
  description: optionalString(5000),
  thumbnail: imagePathSchema,
  cover_image: imagePathSchema,
  is_featured: z.coerce.boolean().optional().default(false),
  status: contentStatusSchema.optional().default('draft'),
});

export type DestinationFormInput = z.infer<typeof destinationSchema>;

/** For each destination gallery photo row (Batch 3 gallery-per-destination CRUD). */
export const destinationGalleryItemSchema = z.object({
  destination_id: z.string().uuid('destination_id tidak valid.'),
  image_url: requiredString('Gambar', 500),
  caption: optionalString(255),
  sort_order: z.coerce.number().int().min(0).optional().default(0),
});

export type DestinationGalleryItemInput = z.infer<typeof destinationGalleryItemSchema>;
