// =============================================================================
// Shared helpers for `src/services/*`. Not a public API on its own — keeps
// every service's list()/paginate() logic consistent (DRY) without forcing
// all entities into one rigid generic CRUD factory, since bookings,
// settings, faq (reorder) and users (auth admin API) each have real
// differences from the plain content-table pattern.
// =============================================================================

import type { Paginated } from '@/lib/database.types';
import { DEFAULT_PAGE, DEFAULT_PER_PAGE } from '@/lib/constants';
import { pageRange, totalPages } from '@/utils/pagination';

export interface BaseListParams {
  page?: number;
  perPage?: number;
  /** Free-text search term (matched with `.ilike()` against the entity's main text column). */
  q?: string;
}

/** Resolves page/perPage defaults and the corresponding Supabase `.range()` bounds. */
export function resolvePageParams(params: BaseListParams) {
  const page = params.page ?? DEFAULT_PAGE;
  const perPage = params.perPage ?? DEFAULT_PER_PAGE;
  const [from, to] = pageRange(page, perPage);
  return { page, perPage, from, to };
}

/** Wraps a Supabase `{ data, count }` result into the shared `Paginated<T>` shape. */
export function toPaginated<T>(data: T[] | null, count: number | null, page: number, perPage: number): Paginated<T> {
  return { data: data ?? [], count: count ?? 0, page, perPage, totalPages: totalPages(count ?? 0, perPage) };
}

/** Throws a plain Error from a Supabase `{ error }` result, so services fail loudly instead of silently returning null. */
export function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}
