import { z } from 'zod';
import { requiredString, contentStatusSchema } from './common.schema';

/** Admin create/edit form for `/admin/faq/*` (Batch 3). */
export const faqSchema = z.object({
  question: requiredString('Pertanyaan', 300),
  answer: requiredString('Jawaban', 5000),
  sort_order: z.coerce.number().int().min(0).optional().default(0),
  status: contentStatusSchema.optional().default('published'),
});

export type FaqFormInput = z.infer<typeof faqSchema>;

/** `POST /api/admin/faq/reorder` — array of FAQ ids in the new display order. */
export const faqReorderSchema = z.object({
  order: z.array(z.string().uuid('id FAQ tidak valid.')).min(1, 'Urutan tidak boleh kosong.'),
});

export type FaqReorderInput = z.infer<typeof faqReorderSchema>;
