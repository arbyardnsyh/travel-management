import { z } from 'zod';
import { requiredString, optionalString, emailSchema } from './common.schema';

/** Public form for `/contact` → `POST /api/public/contact` (Batch 2). */
export const contactPublicSchema = z.object({
  name: requiredString('Nama', 150),
  email: emailSchema,
  subject: optionalString(200),
  message: requiredString('Pesan', 3000),
});

export type ContactPublicInput = z.infer<typeof contactPublicSchema>;
