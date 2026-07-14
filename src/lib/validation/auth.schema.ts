import { z } from 'zod';
import { emailSchema } from './common.schema';

/** Used by `src/pages/login.astro` (existing Batch 1 form — see integration note there). */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ required_error: 'Password wajib diisi.' }).min(1, 'Password wajib diisi.'),
});

export type LoginInput = z.infer<typeof loginSchema>;
