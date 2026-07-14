// =============================================================================
// BACKWARD-COMPATIBLE SHIM.
//
// Enhancement Batch: the implementations that used to live in this file were
// split out into `src/utils/*` (pure formatting/pagination/storage/response
// helpers) and `src/lib/constants.ts` (status enums, storage rules, defaults)
// for a clearer separation between "constants", "utils", and "lib" (Supabase
// client/auth wiring). See ARCHITECTURE.md for the updated map.
//
// This file re-exports everything from its previous public API unchanged, so
// existing imports like `import { formatCurrency, formatDate } from
// '@/lib/helpers'` (used in src/pages/index.astro, src/pages/admin/dashboard.astro,
// etc.) keep working with ZERO changes required — no breaking change.
//
// New code should prefer importing directly from `@/utils/*` / `@/lib/constants`.
// =============================================================================

export { slugify, uniqueSlugSuffix, generateUniqueSlug } from '@/utils/slug';
export { formatCurrency, formatDate, excerpt } from '@/utils/format';
export { parsePagination, pageRange, totalPages } from '@/utils/pagination';
export type { PaginationParams } from '@/utils/pagination';
export { publicStorageUrl, uploadImage, deleteImage } from '@/utils/storage';
export { jsonOk, jsonError, zodIssuesToFieldErrors, redirectAbsolute } from '@/utils/response';
