// =============================================================================
// FormData <-> Zod bridge. Native HTML forms (this project intentionally
// avoids React/Vue for admin/public forms — see ARCHITECTURE.md §9) post
// `multipart/form-data` or `application/x-www-form-urlencoded`, so every
// field arrives as a string. This helper converts a `FormData` into a plain
// object and validates it with a Zod schema, returning a consistent shape
// that both `.astro` pages (native form + redirect) and `/api/**` routes
// (fetch + JSON) can use.
// =============================================================================

import type { ZodTypeAny, z } from 'zod';
import { zodIssuesToFieldErrors } from './response';

export type ParseResult<T> =
  | { success: true; data: T; fieldErrors: null }
  | { success: false; data: null; fieldErrors: Record<string, string> };

/** Converts a FormData instance into a plain object of strings (last value wins for repeated keys, except keys ending in `[]` which become arrays). */
export function formDataToObject(formData: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string') continue; // skip File entries; handled separately via uploadImage()
    const arrayKey = key.endsWith('[]');
    const normalizedKey = arrayKey ? key.slice(0, -2) : key;
    if (arrayKey) {
      const existing = out[normalizedKey];
      out[normalizedKey] = Array.isArray(existing) ? [...existing, value] : [value];
    } else {
      out[normalizedKey] = value;
    }
  }
  return out;
}

/** Validates a FormData payload against a Zod schema. */
export function parseFormData<S extends ZodTypeAny>(formData: FormData, schema: S): ParseResult<z.infer<S>> {
  const raw = formDataToObject(formData);
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { success: false, data: null, fieldErrors: zodIssuesToFieldErrors(result.error.issues) };
  }
  return { success: true, data: result.data, fieldErrors: null };
}

/** Validates a parsed JSON body (e.g. `await request.json()`) against a Zod schema. */
export function parseJsonBody<S extends ZodTypeAny>(body: unknown, schema: S): ParseResult<z.infer<S>> {
  const result = schema.safeParse(body);
  if (!result.success) {
    return { success: false, data: null, fieldErrors: zodIssuesToFieldErrors(result.error.issues) };
  }
  return { success: true, data: result.data, fieldErrors: null };
}
