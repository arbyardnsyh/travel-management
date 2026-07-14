import { z } from 'zod';
import { requiredString, emailSchema } from './common.schema';
import { USER_ROLES } from '@/lib/constants';

const roleSchema = z.enum(USER_ROLES, { errorMap: () => ({ message: `Role harus salah satu dari: ${USER_ROLES.join(', ')}.` }) });

/** Admin create form for `/admin/users/create` (Batch 3, role=admin only). */
export const userCreateSchema = z.object({
  name: requiredString('Nama', 150),
  email: emailSchema,
  password: z.string({ required_error: 'Password wajib diisi.' }).min(8, 'Password minimal 8 karakter.'),
  role: roleSchema,
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;

/** Parses an HTML form's "true"/"false" string into a real boolean — `z.coerce.boolean()` is NOT safe for this (`Boolean("false") === true`). */
export const booleanFromString = z.preprocess((v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '1';
  return v;
}, z.boolean());

/** Admin edit form for `/admin/users/[id]/edit` (Batch 3, role=admin only). Password change is optional here. */
export const userUpdateSchema = z.object({
  name: requiredString('Nama', 150),
  role: roleSchema,
  is_active: booleanFromString.optional().default(true),
});

export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

/** Self-service profile form for `/admin/profile` (Batch 3, any staff role). */
export const profileUpdateSchema = z.object({
  name: requiredString('Nama', 150),
  avatar_url: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

/**
 * Self-service "Ganti Password" form for `/admin/profile` (Batch 3A-8, new —
 * no equivalent existed before this batch). Requires the current password
 * (re-verified server-side via `supabase.auth.signInWithPassword`, see
 * `user.service.ts#changeOwnPassword`) so a hijacked/left-open session can't
 * silently take over the account by changing the password.
 */
export const profilePasswordSchema = z
  .object({
    current_password: z.string({ required_error: 'Password saat ini wajib diisi.' }).min(1, 'Password saat ini wajib diisi.'),
    new_password: z.string({ required_error: 'Password baru wajib diisi.' }).min(8, 'Password baru minimal 8 karakter.'),
    confirm_password: z.string({ required_error: 'Konfirmasi password wajib diisi.' }).min(1, 'Konfirmasi password wajib diisi.'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Konfirmasi password tidak cocok dengan password baru.',
    path: ['confirm_password'],
  });

export type ProfilePasswordInput = z.infer<typeof profilePasswordSchema>;
