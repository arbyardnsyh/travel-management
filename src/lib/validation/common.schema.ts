// =============================================================================
// Shared Zod building blocks (Enhancement Batch). Reused by every schema in
// `src/lib/validation/*` so error messages stay consistent (Indonesian, same
// tone as existing messages in `src/lib/auth.ts` / `login.astro`).
// =============================================================================

import { z } from 'zod';
import { CONTENT_STATUSES, MODERATION_STATUSES, BOOKING_STATUSES } from '@/lib/constants';

/** Trims and requires a non-empty string, with a customizable field label in the error message. */
export const requiredString = (label: string, max = 255) =>
  z
    .string({ required_error: `${label} wajib diisi.` })
    .trim()
    .min(1, `${label} wajib diisi.`)
    .max(max, `${label} maksimal ${max} karakter.`);

/** Optional string — empty string / undefined both normalize to null. */
export const optionalString = (max = 5000) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter.`)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : null));

export const emailSchema = z
  .string({ required_error: 'Email wajib diisi.' })
  .trim()
  .min(1, 'Email wajib diisi.')
  .email('Format email tidak valid.');

/** Coerces form-encoded numeric strings ("150000") into numbers, with a minimum bound. */
export const numericString = (label: string, min = 0) =>
  z.coerce.number({ invalid_type_error: `${label} harus berupa angka.` }).min(min, `${label} minimal ${min}.`);

export const slugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug hanya boleh huruf kecil, angka, dan tanda hubung.')
  .max(255)
  .optional()
  .or(z.literal(''))
  .transform((v) => (v ? v : undefined));

export const contentStatusSchema = z.enum(CONTENT_STATUSES as [string, ...string[]], {
  errorMap: () => ({ message: `Status harus salah satu dari: ${CONTENT_STATUSES.join(', ')}.` }),
});

export const moderationStatusSchema = z.enum(MODERATION_STATUSES as [string, ...string[]], {
  errorMap: () => ({ message: `Status harus salah satu dari: ${MODERATION_STATUSES.join(', ')}.` }),
});

export const bookingStatusSchema = z.enum(BOOKING_STATUSES as [string, ...string[]], {
  errorMap: () => ({ message: `Status harus salah satu dari: ${BOOKING_STATUSES.join(', ')}.` }),
});

/** Validates an uploaded image path (relative storage path OR full http(s) URL) — the string persisted after uploadImage(). */
export const imagePathSchema = z
  .string()
  .trim()
  .max(500)
  .optional()
  .or(z.literal(''))
  .transform((v) => (v ? v : null));
