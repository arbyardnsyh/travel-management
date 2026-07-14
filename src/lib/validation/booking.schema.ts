import { z } from 'zod';
import { requiredString, optionalString, emailSchema, bookingStatusSchema } from './common.schema';

/** Public form for `/booking` → `POST /api/public/booking` (Batch 2). */
export const bookingPublicSchema = z.object({
  tour_id: z.string({ required_error: 'Tour wajib dipilih.' }).uuid('Tour tidak valid.'),
  customer_name: requiredString('Nama', 150),
  customer_email: emailSchema,
  phone: requiredString('Nomor telepon', 30),
  participants: z.coerce
    .number({ invalid_type_error: 'Jumlah peserta harus berupa angka.' })
    .int('Jumlah peserta harus bilangan bulat.')
    .min(1, 'Jumlah peserta minimal 1.'),
  travel_date: z
    .string({ required_error: 'Tanggal perjalanan wajib diisi.' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal tidak valid (YYYY-MM-DD).'),
  notes: optionalString(1000),
});

export type BookingPublicInput = z.infer<typeof bookingPublicSchema>;

/** Admin status update for `/admin/bookings/[id]/status` (Batch 3 / 3A-5) — status only. */
export const bookingStatusUpdateSchema = z.object({
  status: bookingStatusSchema,
});

export type BookingStatusUpdateInput = z.infer<typeof bookingStatusUpdateSchema>;

/**
 * Admin edit form for `/admin/bookings/[id]/edit` (Batch 3A-5). Bookings have
 * no admin Create (per ARCHITECTURE.md §9), but staff may correct customer
 * details entered on the public form (typos in name/email/phone, participant
 * count, travel date) plus internal notes. `tour_id` and `status` are
 * intentionally excluded — status changes go through the dedicated
 * `bookingStatusUpdateSchema` action instead.
 */
export const bookingAdminUpdateSchema = z.object({
  customer_name: requiredString('Nama pelanggan', 150),
  customer_email: emailSchema,
  phone: requiredString('Nomor telepon', 30),
  participants: z.coerce
    .number({ invalid_type_error: 'Jumlah peserta harus berupa angka.' })
    .int('Jumlah peserta harus bilangan bulat.')
    .min(1, 'Jumlah peserta minimal 1.'),
  travel_date: z
    .string({ required_error: 'Tanggal perjalanan wajib diisi.' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal tidak valid (YYYY-MM-DD).'),
  notes: optionalString(1000),
});

export type BookingAdminUpdateInput = z.infer<typeof bookingAdminUpdateSchema>;

/** Notes-only update for `/admin/bookings/[id]/notes` (Batch 3A-5) — a lighter-weight action than the full edit form. */
export const bookingNotesUpdateSchema = z.object({
  notes: optionalString(1000),
});

export type BookingNotesUpdateInput = z.infer<typeof bookingNotesUpdateSchema>;

/** Bulk action for `/admin/bookings` list (Batch 3A-5) — applies one action to several selected bookings at once. */
export const bookingBulkActionSchema = z.object({
  ids: z.array(z.string().uuid('ID booking tidak valid.')).min(1, 'Pilih minimal satu booking.'),
  action: z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'soft_delete'], {
    errorMap: () => ({ message: 'Aksi massal tidak valid.' }),
  }),
});

export type BookingBulkActionInput = z.infer<typeof bookingBulkActionSchema>;
