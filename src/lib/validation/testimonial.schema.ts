import { z } from 'zod';
import { requiredString, optionalString } from './common.schema';

/** Public form for `/testimonials` submit-a-testimonial (Batch 2) — always inserted as status='pending'. */
export const testimonialPublicSchema = z.object({
  name: requiredString('Nama', 150),
  job: optionalString(100),
  photo: optionalString(500),
  rating: z.coerce.number().min(1, 'Rating minimal 1.').max(5, 'Rating maksimal 5.'),
  message: requiredString('Pesan testimoni', 2000),
});

export type TestimonialPublicInput = z.infer<typeof testimonialPublicSchema>;

/** Admin edit form for `/admin/testimonials/[id]/edit` (Batch 3A-4) — same shape as the public submit form (name/job/photo/rating/message); admin acts as moderator, not creator. */
export const testimonialAdminEditSchema = testimonialPublicSchema;

export type TestimonialAdminEditInput = z.infer<typeof testimonialAdminEditSchema>;

/** Admin approve/reject for `/admin/testimonials` (Batch 3). */
export const testimonialModerationSchema = z.object({
  status: z.enum(['approved', 'rejected'], { errorMap: () => ({ message: 'Status harus "approved" atau "rejected".' }) }),
});

export type TestimonialModerationInput = z.infer<typeof testimonialModerationSchema>;
