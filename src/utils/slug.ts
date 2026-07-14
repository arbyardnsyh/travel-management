// =============================================================================
// Slug utilities — moved out of `src/lib/helpers.ts` (Enhancement Batch).
// Re-exported from `src/lib/helpers.ts` for backward compatibility, so any
// existing `import { slugify } from '@/lib/helpers'` keeps working unchanged.
// =============================================================================

/** Converts any string into a URL-safe slug. */
export function slugify(input: string): string {
  return input
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Appends a short random suffix to guarantee slug uniqueness on conflict. */
export function uniqueSlugSuffix(): string {
  return Math.random().toString(36).slice(2, 7);
}

/**
 * Generates a slug candidate and, if `isTaken` reports a conflict, retries
 * with a unique suffix appended (used by services on create/rename so admin
 * forms don't need to hand-roll the retry loop themselves).
 */
export async function generateUniqueSlug(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>
): Promise<string> {
  const baseSlug = slugify(base) || 'item';
  let candidate = baseSlug;
  let attempts = 0;
  while (await isTaken(candidate)) {
    candidate = `${baseSlug}-${uniqueSlugSuffix()}`;
    attempts += 1;
    if (attempts > 5) break; // extremely unlikely; avoids infinite loop
  }
  return candidate;
}
