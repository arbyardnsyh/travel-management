import { z } from 'zod';
import { requiredString, optionalString } from './common.schema';

/** Admin create form for `/admin/gallery/create` (Batch 3). */
export const galleryItemSchema = z.object({
  title: requiredString('Judul', 150),
  image_url: requiredString('Gambar', 500),
  category: optionalString(100),
});

export type GalleryItemFormInput = z.infer<typeof galleryItemSchema>;
