import { z } from 'zod';
import { requiredString, optionalString, numericString, slugSchema, contentStatusSchema, imagePathSchema } from './common.schema';

/** Admin create/edit form for `/admin/tours/*` (Batch 3). */
export const tourSchema = z.object({
  destination_id: z
    .string()
    .uuid('Destinasi tidak valid.')
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  title: requiredString('Judul tour', 200),
  slug: slugSchema,
  price: numericString('Harga', 0),
  duration: optionalString(50),
  quota: z.coerce.number().int('Kuota harus bilangan bulat.').min(0, 'Kuota minimal 0.').optional().default(0),
  description: optionalString(5000),
  thumbnail: imagePathSchema,
  status: contentStatusSchema.optional().default('draft'),
});

export type TourFormInput = z.infer<typeof tourSchema>;
